var xPathToCss = require('xpath-to-css');
function clickOnSelector(){
  return xPathToCss('//button[@id="SortOrder"]');
}

function counClick(network, countLabel){
  return "div[test-ref='network']:nth-child(" + network + ") > div:nth-child(2) > div.countDetail > a[test-ref='" + countLabel + "']";
}

var pagePath = "/mica/network#/search?query=network(exists(Mica_network.id),sort(name))";


var scenarios = [
  {
  "label": "Networks List Page ",
  "path": pagePath,
  "delay": 'searchLoad'
  },
  {
    "label": "Networks List Page go to advanced search page",
    "path": pagePath,
    "clickSelector": ".list-search-widget > div:nth-child(2) > small > a",
    "delay": 'searchLoad'
  },
  {
    "label": "Networks List Page CPTP click on sort button",
    "path": pagePath,
    "clickSelector": 'button#SortOrder',
    "delay": 'delayOnPage'
  },
  {
    "label": "Networks List Page got to bioshare network detail page",
    "path": pagePath,
    "clickSelector": "h4 > a[href*='network/bioshare-eu']",
    "delay" : 'detailPageLoad',
  },
  {
    "label": "Networks List Page got to CPTP network detail page",
    "path": pagePath,
    "clickSelector": "h4 > a[href*='network/cptp']",
    "delay" : 'detailPageLoad',
  },
  {
    "label": "Networks List Page got to RIFA network detail page",
    "path": pagePath,
    "clickSelector": "h4 > a[href*='network/rifa']",
    "delay" : 'detailPageLoad',
  },
  {
    "label": "Networks List Page CPTP click on individual studies count",
    "path": pagePath,
    "clickSelector": counClick('2', 'individualStudyCount'),
    "delay" : 'searchLoad'
  },
  {
    "label": "Networks List Page CPTP click on individual studies with variables count",
    "path": pagePath,
    "clickSelector": counClick('2', 'studyWithVariablesCount'),
    "delay" : 'searchLoad'
  },
  {
    "label": "Networks List Page CPTP click on studies variables count",
    "path": pagePath,
    "clickSelector": counClick('2', 'studyVariableCount'),
    "delay" : 'searchLoad'
  },
  {
    "label": "Networks List Page CPTP click on harmonization studies count",
    "path": pagePath,
    "clickSelector": counClick('2', 'harmonizationStudyCount'),
    "delay" : 'searchLoad'
  },
  {
    "label": "Networks List Page CPTP click on harmonization studies with variables count",
    "path": pagePath,
    "clickSelector": counClick('2', 'harmonizationStudyWithVariablesCount'),
    "delay" : 'searchLoad'
  },
  {
    "label": "Networks List Page CPTP click on datasets count",
    "path": pagePath,
    "clickSelector": counClick('2', 'datasetCount'),
    "delay" : 'searchLoad'
  }
];

module.exports = scenarios;
