// Global variables
// Map
let minZoom = 1;
let maxZoom = 10;

let map2015 = L.map('map_2015', {
    center: [0, 0],
    zoom: 2,
    minZoom: minZoom,
    maxZoom: maxZoom
  });
 
let map2050 = L.map('map_2050', {
    center: [0, 0],
    zoom: 2,
    minZoom: minZoom,
    maxZoom: maxZoom
  });
map2015.sync(map2050);
map2050.sync(map2015);



let current_scenario = "ssp1";
let current_mode = "UN";

let colors = {
  UN:{
    0: '#f7cf5',
    1: '#caeac3',
    2: '#7bc87c',
    3: '#2a924a',
    4: '#00441b'},
  pop:{
    0: '#f7cf5',
    1: '#caeac3',
    2: '#7bc87c',
    3: '#2a924a',
    4: '#00441b'
  },
  NC:{
    0: '#f7cf5',
    1: '#caeac3',
    2: '#7bc87c',
    3: '#2a924a',
    4: '#00441b'
  },
  PN:{
    0: '#f7cf5',
    1: '#caeac3',
    2: '#7bc87c',
    3: '#2a924a',
    4: '#00441b'
  }
};

/*Add a labelsCheckbox */

let basemap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles: Esri',
  maxZoom: 13
});

let basemap1  = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles: Esri',
  maxZoom: 13
});

/* Else if $("labelsCheckbox").checked 

let basemap = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution: 'Tiles: <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 19
});

let basemap1  = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution: 'Tiles: <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 19
});

*/

let promise_layer = new Promise(function(resolve, reject) {
    basemap1.addTo(map2015);
    basemap.addTo(map2050);
    
    setTimeout(() => resolve(1), 10);
  });
  promise_layer.then(function(result) {
    updateMap(current_mode, current_scenario, true);
  });

function switchMode(mode){
    document.getElementById('info_about_measurments').innerText = info_measurements[mode];
    current_mode = mode;
    updateMap(current_mode, current_scenario, true);
}

function switchScenario(scenario){
    current_scenario = scenario;
    updateMap(current_mode, current_scenario);
}


function updateMap(mode, scenario, changeMode = false) {
    if(changeMode) {
        map2015.eachLayer(function(layer) {
            if (layer._url != basemap1._url) {
              map2015.removeLayer(layer);
            }
          });
          tileLayers['cur'][mode].addTo(map2015);
    }
   
    map2050.eachLayer(function(layer) {
        if (layer._url != basemap._url) {
          map2050.removeLayer(layer);
        }
      });
      tileLayers[scenario][mode].addTo(map2050);

      updateLegend()
    console.log('Updating Map: '+ mode+' '+scenario)
}

/*Add map titles*/
var title2015 = L.control({position: 'topright'});
var title2050 = L.control({position: 'topright'});

function addTitles() {
  title2015.onAdd = function () {

      var div = L.DomUtil.create('div', 'info');
      div.innerHTML = "<h1 class='mapTitle'>2015</h1>";
      return div;
  };
  title2050.onAdd = function () {

    var div = L.DomUtil.create('div', 'info');
    div.innerHTML = "<h1 class='mapTitle'>2050</h1>";
    return div;
};

  title2015.addTo(map2015);
  title2050.addTo(map2050);
}

addTitles();

/*Add and uppdate legends */
var legend2015 = L.control({position: 'bottomleft'});
var legend2050 = L.control({position: 'bottomleft'});

function updateLegend() {
  legend2015.onAdd = function () {

      let div = L.DomUtil.create('div', 'mapLegend');
      div.innerHTML = "<h4 class='legendTitle'>Some interesting title</h4>"
      for (let key in colors[current_mode]) {
        div.innerHTML +=
            "<li class='legendList' style=color:"+colors[current_mode][key]+"; float:left; margin-right:10px;><span> " + values[current_mode][key]+" </span></li>";
      }
      return div;
  };
  legend2050.onAdd = function () {

    var div = L.DomUtil.create('div', 'info');
    div.innerHTML = "<h4 class='legendTitle'>Change in %</h4>"
    for (let key in colors[current_mode]) {
      div.innerHTML +=
          "<li class='legendList' style=color:"+colors[current_mode][key]+"; float:left; margin-right:10px;><span> " + values[current_mode][key]+" </span></li>";
    }
    return div;
};

  legend2015.addTo(map2015);
  legend2050.addTo(map2050);
}

updateLegend();




