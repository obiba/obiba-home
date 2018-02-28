var xPathToCss = require('xpath-to-css');
function clickOnSelector(){
  return xPathToCss('//button[@id="SortOrder"]');
}

function counClick(study, countLabel){
  return "div[test-ref='study']:nth-child(" + study + ") > div:nth-child(2) > div > div > a[test-ref='" + countLabel + "']";
}
function openAllPanel(){
  var sclectorsFacetToClick = [];
  for(i = 1; i <= 17; i++){
    sclectorsFacetToClick.push('div.panel-body > uib-accordion > div.panel-group > div:nth-child(' + i + ') a span');
  }
  return sclectorsFacetToClick;
}
var pagePath = "/mica/study/individual-study#/search?query=study(in(Mica_study.className,Study),sort(name))";


var scenarios = [
  {
  "label": "collected Studies List Page ",
  "path": pagePath,
  "delay": 'searchLoad'
  },
  {
    "label": "collected Studies List Page go to advenced search page",
    "path": pagePath,
    "clickSelector": ".list-search-widget > div:nth-child(2) > small > a",
    "delay": 'searchLoad'
  },
  {
    "label": "collected Studies List Page click on sort button",
    "path": pagePath,
    "clickSelector": 'button#SortOrder',
    "delay": 'delayOnPage',
  },
  {
    "label": "Harmonization Studies List Page got to atlantic-path detail page",
    "path": pagePath,
    "clickSelector": "h4 > a[href*='individual-study/atlantic-path']",
    "delay" : 'detailPageLoad'
  },
  {
    "label": "Harmonization Studies List Page got to bcgp detail page",
    "path": pagePath,
    "clickSelector": "h4 > a[href*='individual-study/bcgp']",
    "delay" : 'detailPageLoad'
  },
  {
    "label": "Harmonization Studies List Page got to ttp detail page",
    "path": pagePath,
    "clickSelector": "h4 > a[href*='/individual-study/ttp']",
    "delay" : 'detailPageLoad'
  },
  {
    "label": "collected Studies List Page -atlantic-path- click on Networks count",
    "path": pagePath,
    "clickSelector": counClick('1', 'networkCount'),
    "delay" : 'searchLoad',
  },
  {
    "label": "collected Studies List Page -cag- click on Networks count",
    "path": pagePath,
    "clickSelector": counClick('3', 'networkCount'),
    "delay" : 'searchLoad',
  },
  {
    "label": "collected Studies List Page -cag- click on Datasets count",
    "path": pagePath,
    "clickSelector": counClick('3', 'datasetCount'),
    "delay" : 'searchLoad',
  },
  {
    "label": "collected Studies List Page -cag- click on Variables count",
    "path": pagePath,
    "clickSelector": counClick('3', 'studyVariableCount'),
    "delay" : 'searchLoad',
  }
  ,
  {
    "label": "collected Studies List Page open all facets panel",
    "path": pagePath,
    "clicksSelectors": openAllPanel(),
    "delay" : 'searchLoad',
  },
  {
    "label": "collected Studies List Page input text search atlantic",
    "path": pagePath,
    "inputText": {
      "selector" : "entity-search-typeahead input[type=\"search\"]",
      "text": "atlantic"
    },
    "delay" : 'searchLoad',
  }
];
module.exports = scenarios;
