/* Quick guide to BackstopJS commands

  backstop reference --configPath=backstop.js --scenariosSet=scenarios --host=http://site.dev
  backstop test  --configPath=backstop.js --scenariosSet=scenarios --host=http://site.dev

*/

const searchLoad = 4000;
const delayOnPage = 1000;
const detailPageLoad = 3000;
const removeSelectors = [".navbar-fixed-top", "#fullSearch", "footer.footer"];

function getSpecDelay(sepcDelay){
  switch(sepcDelay){
    case 'searchLoad':
    return searchLoad;
    case 'delayOnPage':
    return delayOnPage;
    case 'detailPageLoad':
    return detailPageLoad;
    default:
    return sepcDelay ? sepcDelay : 500;
  }
}
var args = require('minimist')(process.argv.slice(2)); // grabs the process arguments

switch(args._[0]){
  case 'test':
    if(!args.host || !args.referenceUrl){
      console.log('\x1b[31mMissing arguments\x1b[0m: command | test - arguments :  host | referenceUrl');
      process.exit();
    }
    break;
  case 'reference':
    if(!args.host || !args.referenceUrl){
      console.log('\x1b[31mMissing arguments\x1b[0m: command | reference - arguments :  host | referenceUrl');
      process.exit();
    }
    break;
  case 'openReport':
    if(!args.host || !args.referenceUrl){
      console.log('\x1b[31mMissing arguments\x1b[0m: command | OpenRport - arguments :  host | referenceUrl');
      process.exit();
    }
    break;
  case 'approve':
    if(!args.scenariosSet || !args.host || !args.referenceUrl || !args.layout ){
      console.log('\x1b[31mMissing arguments\x1b[0m: command | approve - arguments : scenariosSet | host | referenceUrl | layout[layout1|layou2] - (Exp: make site-approve scenario=scenariosCollectedStudiesListPage referenceUrl=http://localhost/drupal-release host=http://localhost/drupal layout=layout2)');
      process.exit();
    }
    break;
  
}

var scenariosSet = require('./' + args.layout + '/' + args.scenariosSet);
var scenariosFolder = args.testFolder;
var scenarios = [];
var dev = args.dev;
if (scenariosSet) {
  if(dev && dev=='last'){
    scenariosSet.splice(0, scenariosSet.length-1);
  }
  scenariosSet.forEach(function (scenario) {
    var defaultSetting = {
      "label": scenario.label,
      "url": args.host + scenario.path,
      "delay":  getSpecDelay('delayOnPage') * args.lagServer,
      "removeSelectors" : removeSelectors,
      "misMatchThreshold": 0.01,
      "requireSameDimensions": true
    };
    if(args.referenceUrl){
      defaultSetting.referenceUrl= args.referenceUrl + scenario.path;
    }
    if (scenario.delay) {
      defaultSetting.delay = getSpecDelay(scenario.delay) * args.lagServer;
    }
    if (scenario.removeSelectors) {
      defaultSetting = Object.assign(defaultSetting, {"removeSelectors": scenario.removeSelectors});
    }
    if (scenario.clickSelector) {
      defaultSetting = Object.assign(defaultSetting, {"clickSelector": scenario.clickSelector});
    }
    if (scenario.clicksSelectors) {
      defaultSetting = Object.assign(defaultSetting, {"clicksSelectors": scenario.clicksSelectors});
    }
    if (scenario.selectors) {
      defaultSetting = Object.assign(defaultSetting, {
        "selectors": scenario.selectors,
        "selectorExpansion": false
      });
    }
    if (scenario.inputText) {
      defaultSetting = Object.assign(defaultSetting, {
        "inputText": scenario.inputText
      });
    }
    if (scenario.onReadyScript) {
      defaultSetting = Object.assign(defaultSetting, {
        "onReadyScript": scenario.onReadyScript
      });
  }

    scenarios.push(defaultSetting);
  });
}
if(dev){
  console.log('Scenarios =====>', JSON.stringify(scenarios));
}
// BackstopJS configuration
module.exports =
  {
    "id": "SnapShot Obiba Mica Drupal Tests",
    "viewports": [
      {
        "label": "tablet",
        "width": 1400,
        "height": 100
      }
    ],
    "onReadyScript": "helperClickSelectorScript.js",
    "scenarios": scenarios,
    "paths": {
      "bitmaps_reference": "backstop_data/bitmaps_reference/" + scenariosFolder,
      "bitmaps_test": "backstop_data/bitmaps_test/" +  scenariosFolder,
      "engine_scripts": "engine_scripts",
      "html_report": "backstop_data/html_report/" +  scenariosFolder,
      "ci_report": "backstop_data/ci_report/" +  scenariosFolder
    },
    "report": ["browser"],
    "engine": "chrome",
    "engineOptions": {
      waitTimeout: 15000,
    },
    "asyncCaptureLimit": 5,
    "asyncCompareLimit": 50,
    "debug": false,
    "debugWindow": false
  };
