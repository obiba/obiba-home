var xPathToCss = require('xpath-to-css');
function clickOnSelector(){
  return xPathToCss('//button[@id="SortOrder"]');
}

function counClick(dataset, countLabel){
  return "div[test-ref='dataset']:nth-child(" + dataset + ") > div > div.countDetail > a[test-ref='" + countLabel + "']";
}

var pagePath = "/mica/dataset/harmonized-dataset#/search?query=dataset(in(Mica_dataset.className,HarmonizationDataset),sort(name))";


var scenarios = [
  {
  "label": "Harmonized Datasets List Page ",
  "path": pagePath,
  "delay": 'searchLoad'
  },
  {
    "label": "Harmonized Datasets List Page go to advenced search page",
    "path": pagePath,
    "clicksSelectors": [".list-search-widget > div:nth-child(2) > small > a"],
    "delay": 'searchLoad'
  },
  {
    "label": "Harmonized Datasets List Page click on sort button",
    "path": pagePath,
    "clickSelector": 'button#SortOrder',
    "delay": 'delayOnPage',
  },
  {
    "label": "Harmonized Datasets List Page got to chpt-generic-ds Harmonized-dataset detail page",
    "path": pagePath,
    "clickSelector": "h4 > a[href*='harmonized-dataset/chpt-generic-ds']",
    "delay" : 'detailPageLoad'
  },
  {
    "label": "Harmonized Datasets List Page got to cptp-coreqx Harmonized-dataset detail page",
    "path": pagePath,
    "clickSelector": "h4 > a[href*='harmonized-dataset/cptp-coreqx']",
    "delay" : 'detailPageLoad'
  },
  {
    "label": "Harmonized Datasets List Page -chpt-generic-ds- click on Variables count",
    "path": pagePath,
    "clickSelector": counClick('2', 'variableCount'),
    "delay" : 'searchLoad',
  },
  {
    "label": "Harmonized Datasets List Page input text search chpt",
    "path": pagePath,
    "inputText": {
      "selector" : "entity-search-typeahead input[type=\"search\"]",
      "text": "chpt"
    },
    "delay" : 'searchLoad',
  }
];

module.exports = scenarios;
