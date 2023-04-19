
// ******************************************************************************

// Sscript desarrollado para extraer informacion de los modelos climaticos CMIP5
// este script solo extrae la informacion de precipitaciones en base
// al area de una cuenca , esta se encuentra en formato shapefile, la extraccion
// solo se esta realizando para el periodo historico.

// ******************************************************************************

// autor: Kevin Arnold Traverso Yucra
// mail: arnold.traverso@gmail.com
// fecha: 19/abr/23

// ******************************************************************************

// 1. Ingresar la zona de interes

// Ingresar el shapefile

var HidroCuenca = ee.FeatureCollection("projects/ee-arnoldtraverso/assets/UH_amazonas");

// Agregar a mapa, en base a color

var estilo = {
  fillColor: 'blue',      // Relleno transparente en formato RGBA
  color: 'FFFFFF',        // Borde blanco en formato hexadecimal
  width: 2                // Ancho del borde en pixeles
};

var UHData = HidroCuenca.size().getInfo()
Map.addLayer(HidroCuenca.style(estilo))

// 2. Agregar los atributos para los GCM CMIP5

var listModel = [ 'ACCESS1-0', 'bcc-csm1-1'
                  // 'BNU-ESM', 'CanESM2', 'CCSM4', 'CESM1-BGC', 'CNRM-CM5', 'CSIRO-Mk3-6-0',
                  // GFDL-CM3', 'GFDL-ESM2G', 'GFDL-ESM2M', 'inmcm4', 'IPSL-CM5A-LR', 
                  // 'IPSL-CM5A-MR', 'MIROC-ESM', 'MIROC-ESM-CHEM', 'MIROC5', 'MPI-ESM-LR',
                  // 'MPI-ESM-MR', 'MRI-CGCM3', 'NorESM1-M'
                  ];

var listScenario = ['historical']; // Escenario
var listVariable = ['pr'];         // variable pr, tasmin, tasmax
var listGCMmodel = [];             // lista de modelos

// Definicion de modelos seleccionados

listModel.forEach(function(model){
  listScenario.forEach(function(scenario){
    listVariable.forEach(function(variable){
    var a = [model, scenario, variable]  
    listGCMmodel.push(a)
    })
  })
});

print('ver lista de modelos seleccionados', listGCMmodel)

// Llevando la data de precipitacion a mm/dia

var PcpDATA = function(image){
  return image.multiply(86400)
  .copyProperties(image, ["system:time_start"]
  )};

// Loop para ordenar los modelos

for (var listGCM = 0; listGCM < listGCMmodel.length; listGCM++){
    var param = {model: listGCMmodel[listGCM][0],      // Modelo GCM
                 scenario: listGCMmodel[listGCM][1],   // experimento rcp/historical
                 variable: listGCMmodel[listGCM][2]    // pr, tasmin, tasmax
      
    }
    
  print('Mostrar modelo y escenario:', param.model, param.scenario)

  // Generando una lista vacia
  
  var listEXP = ee.List([]);
  
  // Fechas del modelo historico, Formato Año mes dia (YYYY-MM-DD)
  
  var DateIni = '2000-01-01';
  var DateFin = '2004-12-31';
  
  // 3. Ejecucion para extrccion de datos
  
  for (var i = 1; i <= UHData; i++){
    
    var UH = HidroCuenca.filterMetadata('ID_UH', 'equals', i);
    
    var DatasetGCM = ee.ImageCollection("NASA/NEX-GDDP")
                     .filter(ee.Filter.date(DateIni, DateFin))
                     .filterMetadata('model', 'equals', param.model)
                     .filterMetadata('scenario', 'equals', param.scenario)
                     .filterBounds(UH);
    
    var SelectGCM = DatasetGCM.select(param.variable).map(PcpDATA);
    
    function extrac(image){
      var ValuesPCP = image.select(param.variable)
                      .reduceRegion({
                        reducer: ee.Reducer.mean(),
                        geometry: UH,
                        scale: 25000,
                        maxPixels: 1e12
                      })
                      .get(param.variable)
                      
    var PCP = ee.Feature(null);
    
    return ee.Feature(PCP.set('valor',ee.Number(ValuesPCP))
                         .set('cuenca', 'UH_' + i)
                         .set('fecha', ee.String(image.date().format('YYYY-MM-DD'))))
                      
    }
    
    var PCPGCM = SelectGCM.map(extrac);
    listEXP = listEXP.add(PCPGCM)
    var DataEXP = ee.FeatureCollection(listEXP).flatten();
    
  }
  
  // print('tamaño de muestra:', PCPGCM.size());
   print(DataEXP.limit(5));
}

// ******************************************************************************
// Representando los valores extraidos
// ******************************************************************************

// Estilo de colores

var rgbVis = {
  bands: ['pr'],
  max: 20,
  min: 0,
  'palette': ['604791', '1d6b99', '39a8a7', '0f8755', '76b349', 'f0af07',
            'e37d05', 'cf513e', '96356f', '724173', '9c4f97', '696969']
};

// Seleccionado una fecha para plot

var featureCol = ee.ImageCollection(SelectGCM.filterDate('2000-02-01', '2000-02-02'));

// Agregando al mapa

Map.addLayer(featureCol, rgbVis);

// Estilo para shapefile de cuencas

var estilo2 = {
  fillColor: '00000000',  // Relleno transparente en formato RGBA
  color: 'FFFFFF',        // Borde blanco en formato hexadecimal
  width: 2                // Ancho del borde en pixeles
};

// Agregando al mapa

Map.addLayer(HidroCuenca.style(estilo2));

// ******************************************************************************
// Crear el gráfico de la serie de tiempo
// ******************************************************************************

var chartData = DataEXP.select(['fecha', 'valor']).limit(1440);
print(chartData)

// Ordenando la data

var timeSeriesChart = ui.Chart.feature.byFeature(chartData, 'fecha')
  .setChartType('LineChart')
  .setOptions({
    title: 'Serie de tiempo de valores filtrados por UH',
    legend: { position: 'none' },
    hAxis: { title: 'Fecha' },
    vAxis: { title: 'Valor PP' },
    colors: ['red']
  });

print(timeSeriesChart)

// ******************************************************************************
// Exportar a google Drive
// ******************************************************************************

Export.table.toDrive({
  collection: DataEXP,
  description: 'GCM_CMIP5_'+ param.variable + '_' + param.scenario,
  folder: 'GCM_CMIP5' + '_' + param.variable, 
  fileFormat: 'CSV'
})
