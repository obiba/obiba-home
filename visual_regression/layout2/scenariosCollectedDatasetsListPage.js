var xPathToCss = require('xpath-to-css');
function clickOnSelector(){
  return xPathToCss('//button[@id="SortOrder"]');
}

function counClick(dataset, countLabel){
  return "div[test-ref='dataset']:nth-child(" + dataset + ") > div > div.countDetail > a[test-ref='" + countLabel + "']";
}

var pagePath = "/mica/dataset/collected-dataset#/search?query=dataset(in(Mica_dataset.className,StudyDataset),sort(name))";


var scenarios = [
  {
  "label": "Collected Datasets List Page ",
  "path": pagePath,
  "delay": 'searchLoad'
  },
  {
    "label": "Collected Datasets List Page go to advenced search page",
    "path": pagePath,
    "clickSelector": ".list-search-widget > div:nth-child(2) > small > a",
    "delay": 'searchLoad'
  },
  {
    "label": "Collected Datasets List Page click on sort button",
    "path": pagePath,
    "clickSelector": 'button#SortOrder',
    "delay": 'delayOnPage',
  },
  {
    "label": "Collected Datasets List Page got to CLS-Wave1 collected-dataset detail page",
    "path": pagePath,
    "clickSelector": "h4 > a[href*='collected-dataset/cls-wave1']",
    "delay" : 'detailPageLoad'
  },
  {
    "label": "Collected Datasets List Page got to cls-wave2 collected-dataset detail page",
    "path": pagePath,
    "clickSelector": "h4 > a[href*='collected-dataset/cls-wave2']",
    "delay" : 'detailPageLoad'
  },
  {
    "label": "Collected Datasets List Page got to nuage-t2 collected-dataset detail page",
    "path": pagePath,
    "clickSelector": "h4 > a[href*='collected-dataset/nuage-t2']",
    "delay" : 'detailPageLoad'
  },
  {
    "label": "Collected Datasets List Page CLS-Wave1 click on Variables count",
    "path": pagePath,
    "clickSelector": counClick('2', 'variableCount'),
    "delay" : 'searchLoad',
  },
  {
    "label": "Collected Datasets List Page input text search wave",
    "path": pagePath,
    "inputText": {
      "selector" : "entity-search-typeahead input[type=\"search\"]",
      "text": "wave"
    },
    "delay" : 'searchLoad',
  }
];

module.exports = scenarios;
