// Current dataset depending on what we visualize
// and also the initializations
let firstTime = true;
let dataset = '../Data/country_en.csv';
let dataset_2D = '../Data/nc_degree.csv';
let current_viz = "Food Energy";
let change_dataset = '../Data/ncp_2d_change.csv';
let country_data_2D;
let map_title = document.getElementById('map-name-1');

// plot points on the map for 2D and 3D map
function showData(the_g, data, period, colorScaleSelect) {
  // Add circles to the country which has been selected
  // Removing part is within

  if (checked2D == 'true') {
    // This is just for 2D, we are creating a raster by creating a rectangle
    the_g.selectAll(".plot-point")
      .data(data).enter()
      .append("polygon")
      .classed('plot-point', true)
      .attr("points", function(d) {
        let x_1 = projection([d['lat1'], d['long1']])[0];
        let y_1 = projection([d['lat1'], d['long1']])[1];
        let x_2 = projection([d['lat2'], d['long2']])[0];
        let y_2 = projection([d['lat2'], d['long2']])[1];
        let x_3 = projection([d['lat3'], d['long3']])[0];
        let y_3 = projection([d['lat3'], d['long3']])[1];
        let x_4 = projection([d['lat4'], d['long4']])[0];
        let y_4 = projection([d['lat4'], d['long4']])[1];
        let x_5 = projection([d['lat5'], d['long5']])[0];
        let y_5 = projection([d['lat5'], d['long5']])[1];

        return (x_1 + ',' + y_1 + ' ' +
          x_2 + ',' + y_2 + ' ' +
          x_3 + ',' + y_3 + ' ' +
          x_4 + ',' + y_4 + ' ' +
          x_5 + ',' + y_5);
      })
      .attr("fill", function(d) {
        color = d[period] || 0;
        if (d[period] == 0) {
          return "#ffffff00";
        }
        return colorScaleSelect(color);
      })
      .on('mouseover', tip.show)
      .on('mouseout', tip.hide);
  }
}

// Update data loads the data depending upon the columns for Population, Nitrogen, pollution, export
// and changes the storytelling
function updateData(data_type) {
  switch (data_type) {
    case "Population":
      region_text = "Rural Population";
      dataset_2D = '../Data/rural_pop_degree.csv';
      colorScaleDisplay = parseDataLegends('../Data/water_quantiles.csv', change_labels, 3)
      colorScheme = d3.schemePurples[6];
      colorSchemeDisplay = d3.schemePurples[9];

      break;
    case "Nitrogen":
      region_text = "Total Nitrogen Load";
      colorScaleDisplay = parseDataLegends('../Data/water_quantiles.csv', change_labels, 1)
      dataset_2D = '../Data/n_load_degree.csv';
      colorScheme = d3.schemeOranges[6];
      colorSchemeDisplay = d3.schemeOranges[9];
      break;
    case "Pollution":
      region_text = "Nature's contribution to Water Purification";
      dataset_2D = '../Data/nc_degree.csv';
      colorScaleDisplay = parseDataLegends('../Data/water_quantiles.csv', change_labels, 0)
      colorScheme = d3.schemeGreens[6];
      colorSchemeDisplay = d3.schemeGreens[9];
      break;
    case "Export":
      region_text = "Nitrogen Export";
      dataset_2D = '../Data/n_export_degree.csv';
      colorScaleDisplay = parseDataLegends('../Data/water_quantiles.csv', change_labels, 2)
      colorScheme = d3.schemeReds[6];
      colorSchemeDisplay = d3.schemeReds[9];
      break;
  }
  //Loader for 4 scenarios
  disappearMaps();
  mapsTimeout(4000);

  map_title.innerHTML = region_text;
  colorScale = d3.scaleThreshold()
    .domain([20, 40, 60, 80, 99, 100])
    .range(colorScheme);

  // The color scheme which displays more gradient
  colorScaleDisplay = d3.scaleThreshold()
    .domain([11, 22, 33, 44, 55, 66, 77, 88, 100])
    .range(colorSchemeDisplay);

  updateLegend(colorScale);
  parseData(dataset_2D, doStuff, true);
  svg_map2.selectAll('.plot-point').remove();
}

// Access data loads the daa for 3D and 2D and depending upon that colors
function accessData() {
  g.selectAll("path").attr("fill", function(d) {
      // Pull data for particular iso and set color - Not able to fill it
      if (checked3D == 'true') {
        d.total = data_c[d.properties.iso3] || 0;
        return colorScaleDisplay(d.total);
      } else {
        return '#D3D3D3';
      }
    })
    .attr("d", path);
}

function doStuff(data, firstTime) {
  //Data is usable here
  svg.selectAll('.plot-point').remove();
  if (firstTime) {
    showData(g_map2, data, '2015', colorScaleDisplay);
  }
  showData(g, data, current_SSP, changeColorScaleDisplay);

}

function parseData(url, callBack, firstTime) {
  Papa.parse(url, {
    download: true,
    dynamicTyping: false, // Parse values as their true type (not as strings)
    header: true, // to parse the data as a dictionary
    complete: function(results) {
      callBack(results.data, firstTime);
    }
  });
}
