var xPathToCss = require('xpath-to-css');

function filterSelectorClick(label) {
  return 'div.list-table > div.tab-content > div:nth-of-type(1) > div.btn > label:nth-of-type( ' + label + ')';
}

function resultTableSelectorClick(li) {
  return 'ul[test-ref=search-counts] > li:nth-child(' + li + ') > a';
}

function tabSelectorClick(li) {
  return 'div#search-result-region > div:first-child > ul > li:nth-child(' + li + ') > a';
}

function paginationClick(page) {
  var clacPage = 2 + page;
  return 'div[test-ref=pager] > div > div.pull-right > span > span > ul:first-child > li:nth-child(' + clacPage + ') > a';
}


var pagePath = "/mica/repository#/search";

var scenarios = [
  {
    "label": "Search page list variables",
    "path": pagePath,
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list datasets",
    "path": pagePath,
    "clickSelector": resultTableSelectorClick(2),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list studies",
    "path": pagePath,
    "clickSelector": resultTableSelectorClick(3),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list networks",
    "path": pagePath,
    "clickSelector": resultTableSelectorClick(4),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list return to variable",
    "path": pagePath,
    "clicksSelectors": [resultTableSelectorClick(4), resultTableSelectorClick(1)],
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list variable click variable detail",
    "path": pagePath,
    "clickSelector": xPathToCss('//tr[2]//td[1]//a'),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list variable click variable detail 2",
    "path": pagePath,
    "clickSelector": xPathToCss('//tr[3]//td[1]//a'),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list variable click variable detail 3",
    "path": pagePath,
    "clickSelector": xPathToCss('//tr[4]//td[1]//a'),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list variables Filter individual",
    "path": pagePath,
    "clickSelector": filterSelectorClick(2),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list variables Filter Harmonization",
    "path": pagePath,
    "clickSelector": filterSelectorClick(3),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list variables Filter Harmonization then filter all",
    "path": pagePath,
    "clicksSelectors": [filterSelectorClick(3), filterSelectorClick(1)],
    "delay": 'searchLoad'
  },
  {
    "label": "Search page click to Coverage",
    "path": pagePath + "?query=variable(or(or(in(Mlstr_area.Sociodemographic_economic_characteristics,Age),exists(Mlstr_area.Health_status_functional_limitations)),in(Mlstr_area.Lifestyle_behaviours,Alcohol)))&display=list&bucket=dce",
    "clickSelector": tabSelectorClick(2),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page click to graphics ",
    "path": pagePath,
    "clickSelector": tabSelectorClick(3),
    "delay": 'searchLoad'
  }
  ,
  {
    "label": "Search page click to graphics then return to list",
    "path": pagePath,
    "clicksSelectors": [tabSelectorClick(3), tabSelectorClick(1)],
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list table page 1",
    "path": pagePath,
    "clickSelector": paginationClick(1),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list table page 2",
    "path": pagePath,
    "clickSelector": paginationClick(2),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list table page 3",
    "path": pagePath,
    "clickSelector": paginationClick(3),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list dataset click variables count ",
    "path": pagePath + "?type=datasets",
    "clickSelector": xPathToCss('//tr[2]//td[6]//a'),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list dataset click studies count ",
    "path": pagePath + "?type=datasets",
    "clickSelector": xPathToCss('//tr[2]//td[5]//a'),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list dataset click networks count ",
    "path": pagePath + "?type=datasets",
    "clickSelector": xPathToCss('//tr[2]//td[4]//a'),
    "delay": 'searchLoad'
  },
  {
    "label": "Detail variable DIABETES_TYPE",
    "path": "/mica/variable/cag-baseline%3ADIABETES_TYPE_F%3ACollected",
    "delay": 'searchLoad'
  },
  {
    "label": "Detail variable DIABETES_ONSET",
    "path": "/mica/variable/cag-baseline%3ADIABETES_ONSET%3ACollected",
    "delay": 'searchLoad'
  }
];

module.exports = scenarios;