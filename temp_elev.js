var geometry = 
    ee.Geometry.Polygon(
        [[[10.827071714345609, 51.73049767694755],
          [10.827071714345609, 51.71369593202651],
          [10.881145048085843, 51.71369593202651],
          [10.881145048085843, 51.73049767694755]]], null, false);


var startDate = '2015-05-01';
var endDate = '2022-05-30';


function generate_collection(geometry) {
   var byMonth = ee.ImageCollection('ECMWF/ERA5_LAND/MONTHLY')
    .filter(ee.Filter.date(startDate, endDate))
    .select(['temperature_2m', 'total_precipitation'])
    .map(function (image) { 
      var reflBands = image.select('temperature_2m').subtract(273.15);
      image = image.addBands({
          srcImg: reflBands,
          overwrite: true
      });
      return image;
      
    })
    .map(function (image) {
      
      //https://confluence.ecmwf.int/pages/viewpage.action?pageId=197702790
      //calculation follows the link above: ERA5 monthly averaged reanalysis
      
      var month_start = ee.Date(image.get('system:time_start'));
      var month_end = month_start.advance(1,'months');
      var delta =  month_end.difference(month_start, 'days');
      
      var reflBands = image.select('total_precipitation').multiply(1000).multiply(delta);
      image = image.addBands({
          srcImg: reflBands,
          overwrite: true
      });
      return image;
    })
    .map(function (image) { return image.set('system:time_start', image.get('system:time_start')) });

  return byMonth;
}


function generate_chart(byMonth, geometry) {
  var chart = ui.Chart.image.series({
    imageCollection: byMonth,
    region: geometry,
    scale: 100,
    reducer: ee.Reducer.mean(),

  })
  .setSeriesNames(['Temperature', 'Precipitation'])
  .setOptions({
    series: {
          0: {targetAxisIndex: 0, color: 'e37d05'},
          1: {targetAxisIndex: 1, color: '1d6b99'}
    },
    vAxes: {  0: {
                title: 'Temperature (°C)',
                baseline: 0,
                titleTextStyle: {italic: false, bold: true, color: 'e37d05'}
                },
              1: {
                title: 'Precipitation (mm)',
                titleTextStyle: {italic: false, bold: true, color: '1d6b99'}
                },
           }
  })
  return chart;
}

var elevation_dataset = ee.Image('NASA/NASADEM_HGT/001');
//var elevation_dataset = ee.Image('CGIAR/SRTM90_V4');

function get_elevation(geometry) {
  var elevation =  Math.round(elevation_dataset
    .reduceRegion(ee.Reducer.mean(), geometry, 100).get("elevation").getInfo());
  
  return elevation;
}




function control () {
  //define the left panel with some info and add it to the ui
  var panel = ui.Panel({
    style: { width: '400px' }
  })
  .add(ui.Label("Use drawing tool to define a region."))
  
  ui.root.add(panel);
  

  //define the reset button and add it to the map
  var reset_button = ui.Button({ label: 'Clear drawing', style: { position: 'bottom-left' } });
  var drawingTools = Map.drawingTools();
  
  reset_button.onClick(function () {
    while (drawingTools.layers().length() > 0) {
      var layer = drawingTools.layers().get(0);
      drawingTools.layers().remove(layer);
    }
  });
  
  Map.add(reset_button)
  
  //define chart
  var temperature_chart;
  
  var elevation_string;


  function refresh(geometry) {
    Map.centerObject(geometry);
    panel.remove(temperature_chart);

    panel.remove(elevation_string);
    
  
    var byMonth = generate_collection(geometry);

    temperature_chart = generate_chart(byMonth, geometry);
    panel.add(temperature_chart);
    
    print (byMonth)
    var elevation_value = get_elevation(geometry);
    
    var data = "Elevation: " + elevation_value + "m";
    elevation_string = ui.Label({value: data,  style: {textAlign: "center", width: '400px', fontSize: '30px', color: '484848'}} );
    
    panel.add(elevation_string);

    
  }
  
  //when the user redraw the region, refresh
  Map.drawingTools().onDraw(function (new_geometry) {
    geometry = new_geometry;
    refresh(geometry);
    
    
  })
  
  refresh(geometry);
  
}


control();
