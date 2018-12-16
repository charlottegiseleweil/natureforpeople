class MapPlot {
	constructor(svg_element_id) {
		this.svg = d3.select('#' + svg_element_id);

		// may be useful for calculating scales
		const svg_viewbox = this.svg.node().viewBox.animVal;
		this.svgWidth = svg_viewbox.width;
		this.svgHeight = svg_viewbox.height;


		// FIXME: better load function for both maps
		const map_promise_110 = d3.json("data/map_data/110m.json").then(topojson_raw => {
			const country_features = topojson.feature(topojson_raw, topojson_raw.objects.countries).features;
			// remove leading zeros for the id:s
			country_features.forEach(x => x.id = x.id.replace(/^0+/, ''));
			return country_features;
		})

		const map_promise_50 = d3.json("data/map_data/50m.json").then(topojson_raw => {
			const country_features = topojson.feature(topojson_raw, topojson_raw.objects.countries).features;
			// remove leading zeros for the id:s
			country_features.forEach(x => x.id = x.id.replace(/^0+/, ''));
			return country_features;
		})

		const country_mapping_ndr_promise = d3.json("data/preprocessed_data/ndr_countries.json")
		const country_mapping_poll_promise = d3.json("data/preprocessed_data/poll_countries.json")
		const country_mapping_cv_promise = d3.json("data/preprocessed_data/cv_countries.json")

		const ndr_promise = d3.csv("data/preprocessed_data/ndr_table_preprocessed.csv").then(data => data)
		const poll_promise = d3.csv("data/preprocessed_data/poll_table_preprocessed.csv").then(data => data)
		const cv_promise = d3.csv("data/preprocessed_data/cv_table_preprocessed.csv").then(data => data)

		const country_label_promise = d3.tsv("data/map_data/world-110m-country-names.tsv").then(data => data)

		Promise.all([map_promise_110, map_promise_50, country_label_promise, ndr_promise, 
					poll_promise, cv_promise, country_mapping_ndr_promise, country_mapping_poll_promise, country_mapping_cv_promise]).then((results) => {

			this.map_data = results[0];  // 110m map
			this.map_data_50 = results[1];  // 50m map
			const country_label_data = results[2];  // country label names

			this.ndr_data = results[3];  // data
			this.poll_data = results[4];
			this.cv_data = results[5];

			this.ndr_country_mapping = results[6];  // mapping between country name and data points
			this.poll_country_mapping = results[7];  
			this.cv_country_mapping = results[8]; 
			
			this.currentData = this.ndr_data;
			this.currentCountryMapping = this.ndr_country_mapping
			
			// add country name labels to map_data objects  TODO: add this to preprocessing instead
			this.map_data.forEach(x => Object.assign(x, country_label_data.find(country_label => country_label['id'] == x['id'])))
			this.map_data_50.forEach(x => Object.assign(x, country_label_data.find(country_label => country_label['id'] == x['id'])))

			const center_x = this.svgWidth/2;
			const center_y = this.svgHeight/2;	
			const scale = 380;
			this.scaleExtent = [0.8, 5];
			this.resetScale = scale;
			this.resetRotate = [0, 0];
			this.activeClick = d3.select(null)
			this.clickedRotate; 
			this.clickedScale;
			this.focused = false;
			this.focusedCountry = "";
			this.currentDatasetName = "ndr";
			// the current scenario, either 'cur', 'ssp1', 'ssp3' or 'ssp5'
            this.currentScenario = "cur";
            
                        
            // save the latest zoom before story - after reset set this value again to 0 - kin of a story mode variable
			this.scaleBeforeStory = 0;

            
            // initialize versor vectors
            this.v0; 
            this.r0; 
            this.q0;

			// color scale for the data points in the focused mode
			// TODO: VERY IMPORTANT; we need a scale for the zoomed 
			// in mode to be able to compare the colors to the extreme values of the whole 
			// world, to see if they are bad or not, (in addition to the comparison within
			// a country)
			this.focused_color_scale = d3.scaleLinear()
				.range(["green", "red"])
				.interpolate(d3.interpolateHcl);
			this.world_color_scale = d3.scaleLinear()
				.range(["green", "red"])
				.interpolate(d3.interpolateHcl);

			this.projection = d3.geoOrthographic()
				.rotate([0, 0])
				.scale(scale)
				.translate([center_x, center_y]);

			this.path = d3.geoPath(this.projection);

			this.countryTooltip = d3.select("body").append("div").attr("class", "countryTooltip");

            // the main globe object
            let that = this;
			this.svg.selectAll("path")
			 	.data(this.map_data)
			 	.enter().append("path")
				.attr("fill", "grey")
				.attr("d", this.path)
				.on("mouseover", function(d) {
					that.countryTooltip.text(d.name)
						.style("left", (d3.event.pageX + 7) + "px")
						.style("top", (d3.event.pageY - 15) + "px")
						.style("display", "block")
						.style("opacity", 1);
					d3.select(this).classed("selected", true)
				})
				.on("mouseout", function(d) {
					that.countryTooltip.style("opacity", 0)
						.style("display", "none");
					d3.select(this).classed("selected", false)	
				})
				.on("click", this.clicked())
            
            this.quadtree = this.setupQuadtree();
			this.updateNodes(this.quadtree);

			this.initializeZoom();
			this.drawMarkers();
			showStory(0, true);
			
			
			// TODO: CIRCLE AROUND WORLD 
			// svg.selectAll("path").enter()
			// 	.append("circle")
			// 		.attr("transform", "translate([400,400])")
			// 		.attr('r', scale+10)
			// 		.attr("fill", "yellow")
		});

    }
    
    render() {
        // Update country borders
        this.svg.selectAll("path").attr('d', this.path)

        if (!this.focused) {
            let dataSelection = this.worldDataSelection();
            dataSelection.exit().remove();
            this.initWorldMapData(dataSelection);
        }

        // Update positions of circles (both data points and story markers)
        this.svg.selectAll("circle")
            .attr("transform", (d) => `translate(${this.projection([d.lng, d.lat])})`)

        this.svg.selectAll("circle")
            // make the data dots disappear when they are on the other side of the globe.
            .style("display", (d) => {  
                var globeDistance = d3.geoDistance([d.lng, d.lat], this.projection.invert([this.svgWidth/2, this.svgHeight/2]));
                return (globeDistance > 1.42) ? 'none' : 'inline';
            })
    }
    
    initializeZoom() {
        // Call the zoom on the svg instead of the path elements to make sure that it is possible to drag 
        // everywhere on the globe (and not just on land)
        let that = this;
        this.svg.call(d3.zoom()  
            .on("start", function() {
                that.v0 = versor.cartesian(that.projection.invert(d3.mouse(this)));
                that.r0 = that.projection.rotate();
                that.q0 = versor(that.r0);
            })
            .on('zoom', function() {
                that.projection.scale(d3.event.transform.k * (that.svgHeight - 10) / 2);
            
                let v1 = versor.cartesian(that.projection.rotate(that.r0).invert(d3.mouse(this)));
                let q1 = versor.multiply(that.q0, versor.delta(that.v0, v1));
                let r1 = versor.rotation(q1);
                r1[2] = 0;  // Don't rotate Z axis
                that.projection.rotate(r1);
                that.render()
            })
            .scaleExtent(this.scaleExtent));
    }
    
        
    setupQuadtree() {
        let quadtree = d3.quadtree()
            .x((d) => d.lng)
            .y((d) => d.lat)
            .addAll(this.currentData);
        return quadtree;
    }

    // Precomputes the node width (TODO: _)
    updateNodes(quadtree) {
        quadtree.visit(function (node, x1, y1, x2, y2) {
            node.width = x2 - x1;
        });
    }
    
    // Find the nodes within the specified rectangle.
    search(quadtree, x0, y0, x3, y3) {
        let pts = [];
        let subPixel = false;
        let subPts = [];
        let nodeScale = this.projection.scale() * 0.0005;  // måste ändras
        let counter = 0;
        let counter2 = 0; 
        
        let mapCenter = this.projection.invert([this.svgWidth/2, this.svgHeight/2]);

        quadtree.visit(function (node, x1, y1, x2, y2) {
            let p = node.data;
            let pwidth = node.width * nodeScale;

            // -- if this is too small rectangle only count the branch and set opacity
            if ((pwidth * pwidth) <= 1) {
                // start collecting sub Pixel points
                subPixel = true;
            }
                // -- jumped to super node large than 1 pixel
            else {
                // end collecting sub Pixel points
                if (subPixel && subPts && subPts.length > 0) {

                    subPts[0].group = subPts.length;
                    let indexOfMax = d3.scan(subPts, (a, b) => parseInt(b[`UN_${plot_object.currentScenario}`])- parseInt(a[`UN_${plot_object.currentScenario}`]));
                    pts.push(subPts[indexOfMax]); // add only the point with the highest data value
                    counter += subPts.length - 1;
                    subPts = [];
                }
                subPixel = false;
            }

            if ((p) && d3.geoDistance([p.lng, p.lat], mapCenter) < 1.57) {  // kanske ändra denna för att se vinklingen mer
                counter2 += 1;
                if (subPixel) {
                    subPts.push(p);
                }
                else {
                    if (p.group) {
                        delete (p.group);
                    }
                    pts.push(p);
                }
            }

            // if the quad tree visit rectangle is outside of the search rectangle then we don't want to visit the sub nodes
            // the rather complex logic here is because of the -180/180 longitude border
            if (y2 < y3 - 10 || y1 > y0 + 10) return true;  // The added and subtracted 10s are to make sure points are rendered at top and bottom properly
            if (x3 > x0 && x2 > x1)  // if none of the areas are over the longitude 180/-180
                return x1 > x3 || x2 < x0;  // if true, don't search over this area (because it does not overlap)
            else if (x3 > x0 || x2 > x1)  // if one of the areas are over the longitude 180/-180 
                return x1 > x3 && x2 < x0;
            else return false  // else both areas are over the longitude 180/-180 ==> they are overlapping ==> return false
        });
        // console.log(" Number of removed  points: " + counter);
        // console.log(" Number of kept points: " + pts.length)
        // console.log(" currentScale: " + this.projection.scale());
        // console.log("counter2: " + counter2);
        // if (counter2 == 0) {
        //     console.log("uasid")
        // }
        return pts;

    }

    // Updates all data using the currentData variable
    update_all() {
        if (this.focused) {
            let dataSelection = this.focusedDataSelection();
            dataSelection.exit().remove();
            this.setWorldColorScale();
            this.initFocusedMapData(dataSelection);
        } else {
            this.quadtree = this.setupQuadtree();
            this.updateNodes(this.quadtree);
            this.setWorldColorScale();
            this.render();
        }
    }

    worldDataSelection() {
        // let threshold;
        // switch(currentDatasetName) {
        // 	case 'ndr':
        // 		threshold = 30000000;
        // 		break;
        // 	case 'poll':
        // 		threshold = 30000;
        // 		break;
        // 	case 'cv':
        // 		threshold = 3.4;
        // 		break;
        // 
        // return svg.selectAll("circle.datapoints")
        // 	.data(currentData.filter((d) => d[`UN_${plot_object.currentScenario}`] > threshold), (d) => d);
        let topLeft = this.projection.invert([0, 0]);
        let topRight = this.projection.invert([this.svgWidth, 0]);
        let top = this.projection.invert([this.svgWidth/2, 0])[1];
        let bottom = this.projection.invert([this.svgWidth/2, this.svgHeight])[1];
        let bottomLeft = this.projection.invert([0, this.svgHeight]);
        let bottomRight =this. projection.invert([this.svgWidth, this.svgHeight]);

        return this.svg.selectAll("circle.datapoints")
            .data(this.search(this.quadtree, Math.min(bottomLeft[0], topLeft[0]), top, Math.max(bottomRight[0], topRight[0]), bottom), (d) => d);
    }

    setWorldColorScale() {
        this.world_color_scale.domain(d3.extent(this.currentData, x => parseInt(x[`UN_${plot_object.currentScenario}`])));
    }

    initWorldMapData(worldDataSelection) {
        worldDataSelection.enter().append("circle")
            .attr("r", 3)
            .attr("class", "datapoints")
            .style("fill", (d) => this.world_color_scale(parseInt(d[`UN_${this.currentScenario}`])))
    }

    focusedDataSelection() {
        // Get data for just the country that is focused (all data available)
        let focusedCountryData = this.currentCountryMapping[`${this.focusedCountry}`].reduce((acc, cur) => {
            acc.push(this.currentData[cur]);
            return acc;
        }, []);

        return this.svg.selectAll("circle.datapoints").data(focusedCountryData, (d) => d);
    }

    initFocusedMapData(focusedDataSelection) {
        // Add focused country data
        focusedDataSelection.enter().append("circle")
            .attr("r", "3")
            .attr("class", "datapoints")
            .attr("transform", (d) => `translate(${this.projection([d.lng, d.lat])})`)
            .style("fill", (d) => this.world_color_scale(d[`UN_${this.currentScenario}`]))
            .style("display", "inline")
    }

    clicked(that=this, fromStory=false) {
        return function(d) {
            // hide story points before transition
            that.svg.selectAll("circle").remove()
            // hide story btns if discovery mode
            if (!fromStory) {document.getElementById("story-btn-section").style.display = "none";}

            if (that.activeClick.node() === this) return that.resetClick();  // zoom out again if click on the same country
            else if (that.activeClick.node() != null) return null;  // else if we are already zoomed in, do nothing

            that.focusedCountry = d.name;
            if (that.focusedCountry == undefined) return null;

            that.activeClick.classed("active", false);
            that.activeClick = d3.select(this).classed("active", true);
            
            that.svg.on('.zoom', null).on('.start', null);  // disable zoom and drag while focused on a country

            let currentRotate = that.projection.rotate();
            let currentScale = that.projection.scale();
            that.resetRotate = currentRotate;
            that.resetScale = currentScale

            let p_center = d3.geoCentroid(d)
            
            that.projection.rotate([-p_center[0], -p_center[1]]);
            that.path.projection(that.projection);
            
            // calculate the scale and translate required:
            var b = that.path.bounds(d);
            that.clickedScale = currentScale * 1.5 / Math.max((b[1][0] - b[0][0]) / (that.svgWidth/2), (b[1][1] - b[0][1]) / (that.svgHeight/2));
            that.clickedRotate = that.projection.rotate();
            
            let end_callback_triggered = false;
            
            let dataSelection = that.focusedDataSelection();
            
            // Update the map:
            d3.selectAll("path")
                .transition()
                .attrTween("d", that.zoomRotateFactory(currentRotate, currentScale, that.clickedRotate, that.clickedScale))
                .duration(1000)
                .on("end", () => {
                    if (!end_callback_triggered) {
                        if (fromStory) {
                            that.init_50map(d, true)
                        } else {
                            that.init_50map(d)
                            
                        }							
                        end_callback_triggered = true
                        d3.select(this).classed("selected", false)
                        that.initFocusedMapData(dataSelection);
                        }
                    });
                    
            // Remove the world map data
            that.focused = true;
            dataSelection.exit().remove()
        }
    }

    resetClick(fromStory=false) {
        this.activeClick.classed("active", false);
        this.activeClick = d3.select(null);
        
        this.init_110map()
        showStory(1, true)
        this.svg.selectAll("circle").remove()

        let dataSelection = this.worldDataSelection();
        this.focused = false;

        let already_triggered = false

        // if reset comes explore mode
        if (!fromStory) {
            d3.selectAll("path")
            .transition()
            .attrTween("d", this.zoomRotateFactory(this.clickedRotate, this.clickedScale, this.resetRotate, this.resetScale))
            .duration(1000)
            .on("end", () => {
                if (!already_triggered) {
                    this.initWorldMapData(dataSelection);
                    this.initializeZoom()
                    
                    already_triggered = true
                    document.getElementById("story-btn-section").style.display = "block";
                    this.render()	
                }
            })
        } else {
        // if reset comes from story
            d3.selectAll("path")
            .transition()
            .attrTween("d", this.zoomRotateFactory(this.clickedRotate, this.clickedScale, this.clickedRotate, this.scaleBeforeStory))
            .duration(1000)
            .on("end", () => {
                if (!already_triggered) {
                    this.initWorldMapData(dataSelection);
                    this.initializeZoom()
                    
                    already_triggered = true
                    this.render()	
                    this.scaleBeforeStory = 0
                }
            })
        }
    }

    zoomRotateFactory(currRot, currScale, nexRot, nexScale, that=this) {
        return (d) => {
            var r = d3.interpolate(currRot, nexRot);
            var s = d3.interpolate(currScale, nexScale);
                return function(t) {
                    that.projection
                        .rotate(r(t))
                        .scale(s(t));
                that.path.projection(that.projection);
                if (that.path(d) == null) return ""; else return that.path(d);
                }
            }
    }

    
    // initializing HD map after zooming in
    init_50map(country_sel, fromStory=false) {
        // hide tooltip
        this.countryTooltip.style("opacity", 0)
                .style("display", "none");

        // if zoom comes from story mode or explore mode
        if (!fromStory) {
            this.svg.selectAll("path").remove().enter()
                .data(this.map_data_50)
                .enter().append("path")
                .attr("fill-opacity","0.5")
                .attr("fill", function (d){
                    if (d.name == country_sel.name) {
                        let story = { 
                            header: d.name, 
                            text: "Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy \
                                eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua."}
                        showStory_for_country_without_data(story)
                        return "grey"
                    }
                    return "white";
                })
                .attr("d", this.path)
                .on("click", () => {
                    this.resetClick(false)
                })
        } else {
            this.svg.selectAll("path").remove().enter()
                .data(this.map_data_50)
                .enter().append("path")
                .attr("fill", function (d){
                    if (d.name == country_sel.name) { 
                        return "dimgray"
                    }
                    return "grey";
                })
                .attr("d", this.path)
                .on("click", () => {
                    this.resetClick(true)
                })
        }
        this.drawMarkers()
        this.render()
    }

    // initializing LOW RES map after zooming out
    init_110map() {
        let that = this;
        this.svg.selectAll("path").remove().enter()
            .data(this.map_data)
            .enter().append("path")
            .attr("fill", "grey")
            .attr("d", this.path)
            .on("click", this.clicked())
            .on("mouseover", function(d){
                that.countryTooltip.text(d.name)
                    .style("left", (d3.event.pageX + 7) + "px")
                    .style("top", (d3.event.pageY - 15) + "px")
                    .style("display", "block")
                    .style("opacity", 1);
                d3.select(this).classed("selected", true)
            })
            .on("mouseout", function(d){
                that.countryTooltip.style("opacity", 0)
                    .style("display", "none");
                d3.select(this).classed("selected", false)
            })
        this.drawMarkers()

    }

    //FIXME:
    // find country object in json
    getCountryByCode(code) {
        return this.map_data.filter(
            function(map_data){ return map_data.name == code }
        );
    }
    
    // after user clicked any story arrow find country object and navigate to country from story
    clicked_Story(country){
        if(this.scaleBeforeStory == 0) {
            this.scaleBeforeStory = this.projection.scale()
        }

        // low res map before transition
        this.init_110map()

        // find country element
        let found = this.getCountryByCode(country)[0];

        //let p_center = d3.geoCentroid(found)

        // transition
        this.clicked(this, true)(found)
    }

    setDataset(dataset) {  //TODO: disable switches during transition
        this.currentDatasetName = dataset;
        switch (this.currentDatasetName) {
            case 'ndr': 
                this.currentData = this.ndr_data;
                this.currentCountryMapping = this.ndr_country_mapping;
                break;
            case 'poll':
                this.currentData = this.poll_data;
                this.currentCountryMapping = this.poll_country_mapping;
                break;
            case 'cv':  
                this.currentData = this.cv_data;
                this.currentCountryMapping = this.cv_country_mapping;
                break; 
            
        }
        this.update_all();
    }
    
    setScenario(scenario) {
        this.currentScenario = scenario;
        this.update_all();
    }
    switchStory(story) {
        let c = story.country
        this.clicked_Story(story.country)
    }

    // Story markers
    drawMarkers() {
        const center = [this.svgWidth/2, this.svgHeight/2];
        let locations = stories;
        var markers = this.svg.selectAll("circle.story-markers")
            .data(locations);

        markers.enter()
            .append('circle')
            .attr("class", "story-markers")
            .merge(markers)
            // .attr('cx', d => projection([d.lat, d.lng])[0])
            // .attr('cy', d => projection([d.lat, d.lng])[1])
            .attr('fill', d => {
                const coordinate = [d.lat, d.lng];
                let gdistance = d3.geoDistance(coordinate, this.projection.invert(center));
                return gdistance > 1.58 ? 'none' : 'Peru';
            })
            .attr('r', 9);

            
        // set them to the front layer
        markers.each(function () {
            this.parentNode.appendChild(this);
        });
    }
    
}