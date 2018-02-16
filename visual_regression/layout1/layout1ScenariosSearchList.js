var xPathToCss = require('xpath-to-css');

var  querySelectors =  [
    '.taxo-element > li:nth-child(1) > span > ul:nth-child(1)',
    '.taxo-element > li:nth-child(1) > span > ul:nth-child(2) > li:nth-child(2) > a',
    '.search-browser > .panel-body  ul.nav-pills > li:nth-child(1) > a',
    '.search-browser > .panel-body  a.btn-xs'
  ];

  function clickSelectorToQuery(selectors){
    var query = querySelectors.slice();
    selectors.map(function(selector){
      query.push(selector);
    });
    return query;
    }

function filterSelectorClick(label) {
  return 'div.list-table > div.tab-content > div:nth-of-type(1) > div.btn > label:nth-of-type( ' + label + ')';
}

function resultTableSelectorClick(li) {
  return 'ul[test-ref="search-counts"] > li:nth-child(' + li + ') > a';
}

function tabSelectorClick(li) {
  return 'div#search-result-region > div:first-child > ul > li:nth-child(' + li + ') > a';
}

function paginationClick(page) {
  var clacPage = 2 + page;
  return 'div[test-ref="pager"] > div > div.pull-right > span > span > ul:first-child > li:nth-child(' + clacPage + ') > a';
}

var pagePath = "/mica/repository#/search";
var pagePathQuery = '/mica/repository#/search?query=variable(match(*,Mica_variable.name))';
var scenarios = [
  {
    "label": "Search page list variables",
    "path": pagePath,
    "clicksSelectors": querySelectors,
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list datasets",
    "path": pagePathQuery + "&type=datasets",
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list studies",
    "path": pagePathQuery + "&type=studies",
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list networks",
    "path": pagePathQuery + "&type=networks",
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list return to variable",
    "path": pagePathQuery + "&type=networks",
    "clickSelector": resultTableSelectorClick(1),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list variable click variable detail",
    "path": pagePathQuery,
    "clickSelector": xPathToCss('//tr[2]//td[1]//a'),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list variable click variable detail 2",
    "path": pagePathQuery,
    "clickSelector":xPathToCss('//tr[3]//td[1]//a'),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list variable click variable detail 3",
    "path": pagePathQuery,
    "clickSelector": xPathToCss('//tr[4]//td[1]//a'),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list variables Filter individual",
    "path": pagePathQuery,
    "clickSelector": filterSelectorClick(2),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list variables Filter Harmonization",
    "path": pagePathQuery,
    "clickSelector": filterSelectorClick(3),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list variables Filter Harmonization then filter all",
    "path": pagePathQuery,
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
    "path": pagePathQuery,
    "clickSelector": tabSelectorClick(3),
    "delay": 'searchLoad'
  }
  ,
  {
    "label": "Search page click to graphics then return to list",
    "path": pagePathQuery,
    "clicksSelectors": [tabSelectorClick(3),tabSelectorClick(1)],
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list table page 1",
    "path": pagePathQuery,
    "clickSelector": paginationClick(1),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list table page 2",
    "path": pagePathQuery,
    "clickSelector": paginationClick(2),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list table page 3",
    "path": pagePathQuery,
    "clickSelector": paginationClick(3),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list dataset click variables count ",
    "path": pagePathQuery,
    "clicksSelectors": [resultTableSelectorClick(2),xPathToCss('//tr[2]//td[6]//a')],
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list dataset click studies count ",
    "path": pagePathQuery + "&type=datasets",
    "clicksSelectors": [resultTableSelectorClick(2),xPathToCss('//tr[2]//td[5]//a')],
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list dataset click networks count ",
    "path": pagePathQuery + "&type=datasets",
    "clicksSelectors": [resultTableSelectorClick(2),xPathToCss('//tr[2]//td[4]//a')],
    "delay": 'searchLoad'
  },
  {
    "label": "Search page list dataset click networks count ",
    "path": pagePathQuery + "&type=datasets",
    "clicksSelectors": [resultTableSelectorClick(2),xPathToCss('//tr[2]//td[4]//a')],
    "delay": 'searchLoad'
  }
];

module.exports = scenarios;