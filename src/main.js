
// python -m http.server

class MapPlot {
	constructor(svg_element_id) {
		this.svg = d3.select('#' + svg_element_id);

		// may be useful for calculating scales
		const svg_viewbox = this.svg.node().viewBox.animVal;
		this.svg_width = svg_viewbox.width;
		this.svg_height = svg_viewbox.height;


		const map_promise = d3.json("data/map_data/110m.json").then(topojson_raw => {
			const country_features = topojson.feature(topojson_raw, topojson_raw.objects.countries).features;
			// remove leading zeros for the id:s
			country_features.forEach(x => x.id = x.id.replace(/^0+/, ''));
			return country_features;
		})

		const country_label_promise = d3.tsv("data/map_data/world-110m-country-names.tsv").then(data => data)

		Promise.all([map_promise, country_label_promise]).then((results) => {
			let map_data = results[0];
			let country_label_data = results[1];
			
			map_data.forEach(x => Object.assign(x, country_label_data.find(country_label => country_label['id'] == x['id'])))

			let center_x = this.svg_width/2;
			let center_y = this.svg_height/2;	

			let scale = 380;
			const base_sense = 0.25;
			let sense = base_sense;
			let max_y_angle = 25;

			let projection = d3.geoOrthographic()
				.rotate([0, 0])
				.scale(scale)
				.translate([center_x, center_y])

			let path = d3.geoPath(projection)		

			var world = this.svg
			//var worldGroup = world.append("g");

			var zoom = d3.zoom()
			.scaleExtent([1, 3]) //bound zoom
			.on("zoom", () => {
				console.log(sense)
				sense = base_sense/d3.event.transform.translate(projection).k
				console.log(sense)

				projection.scale(d3.event.transform.translate(projection).k * scale)
				this.svg.selectAll("path").attr("d", path);
			});
		

			var countryTooltip = d3.select("body").append("div").attr("class", "countryTooltip")

			this.svg.selectAll("path")
				.data(map_data)
				.enter().append("path")
				.attr("d", path)
				.attr("fill", function(d){
					return "grey"
				})
				.on("mouseover", function(d){
					countryTooltip.text(d.name)
						.style("left", (d3.event.pageX + 7) + "px")
						.style("top", (d3.event.pageY - 15) + "px")
						.style("display", "block")
						.style("opacity", 1);
					d3.select(this).classed("selected", true)
				})
				.on("mouseout", function(d){
					countryTooltip.style("opacity", 0)
						.style("display", "none");
					d3.select(this).classed("selected", false)
				})

			this.svg.call(d3.drag()
				.on("drag", () => {
					let rotate = projection.rotate();
					let x_angle = rotate[0] + d3.event.dx * sense
					let y_angle = rotate[1] - d3.event.dy * sense;
					if (Math.abs(y_angle) > max_y_angle) {
						if (y_angle > 0) y_angle = max_y_angle 
						else y_angle = -max_y_angle
					}

					projection.rotate([x_angle, y_angle]);
					this.svg.selectAll("path").attr("d", path);
				})).call(zoom);
		});
	}
}
			

function whenDocumentLoaded(action) {
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", action);
	} else {
		// `DOMContentLoaded` already fired
		action();
	}
}

whenDocumentLoaded(() => {
	plot_object = new MapPlot('globe-plot');
	// plot object is global, you can inspect it in the dev-console
});
