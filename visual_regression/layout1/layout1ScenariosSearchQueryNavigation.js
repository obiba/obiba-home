var querySelectors = ['.taxo-element > li:nth-child(1) > span > ul:nth-child(1)',
'.taxo-element > li:nth-child(1) > span > ul:nth-child(2) > li:nth-child(2) > a',
'.search-browser > .panel-body  ul.nav-pills > li:nth-child(1) > a',
'.search-browser > .panel-body  a.btn-xs'
];

function  querySelectorsEntity(li){
  return '.taxo-element > li:nth-child(' + li + ') a';
}

function querySelectorTaxoPanel(entity, taxo){
  return  ['.taxo-element > li:nth-child(' + entity + ') > span > ul:nth-child(1) a', 
  '.taxo-element > li:nth-child(' + entity + ') > span > ul:nth-child(2) > li:nth-child(' + taxo + ') > a'
  ]
}

function querySelectorTaxoPanelAddQuery(entity, taxo, query){
  return  ['.taxo-element > li:nth-child(' + entity + ') > span > ul:nth-child(1) a', 
  '.taxo-element > li:nth-child(' + entity + ') > span > ul:nth-child(2) > li:nth-child(' + taxo + ') > a',
  '.search-browser > .panel-body  ul.nav-pills > li:nth-child(' + query + ') > a',
  '.search-browser > .panel-body  a.btn-xs'
  ]
}

function builderClick(taxo, btn, popTitle){
  var selector = ['div[id*=' + taxo + '] .btn-' + btn];
  if(popTitle){
    selector.push('li[popover-title*=' + popTitle + '] input')
  }
  return selector;
}
var pagePath = "/mica/repository#/search";
var pagePathQuery = '/mica/repository#/search?query=variable(or(or(in(Mlstr_area.Sociodemographic_economic_characteristics,Sex),in(Mlstr_area.Symptoms_signs,Skin_subcut_sympt)),in(Mlstr_additional.Target,Participant)))';

var scenarios = [
  {
    "label": "Search page list variables",
    "path": pagePath,
    "clicksSelectors": querySelectors,
    "delay": 'searchLoad'
  },
  {
    "label": "Search page Click variables property",
    "path": pagePath,
    "clickSelector": querySelectorsEntity(1),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page Click datasets property",
    "path": pagePath,
    "clickSelector": querySelectorsEntity(2),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page Click studies property",
    "path": pagePath,
    "clickSelector": querySelectorsEntity(3),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page Click networks property",
    "path": pagePath,
    "clickSelector": querySelectorsEntity(4),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page Click browser covarage property",
    "path": pagePath,
    "clickSelector": querySelectorsEntity(5),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page Click variables Area of information",
    "path": pagePath,
    "clicksSelectors": querySelectorTaxoPanel(1, 1),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page Click variables property",
    "path": pagePath,
    "clicksSelectors": querySelectorTaxoPanel(1, 2),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page Click variabl1es target & source",
    "path": pagePath,
    "clicksSelectors": querySelectorTaxoPanel(1, 3),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page Click variables get Lifestyle and health",
    "path": pagePath,
    "clicksSelectors": querySelectorTaxoPanelAddQuery(1, 1, 2),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page Click variables get Source",
    "path": pagePath,
    "clicksSelectors": querySelectorTaxoPanelAddQuery(1, 3, 1),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page Add  Age/birthdate term",
    "path": pagePathQuery,
    "clicksSelectors": builderClick("Sociodemographic_economic_characteristics", "variable", "birth"),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page Remove Sociodemographic_economic_characteristics taxo",
    "path": pagePathQuery,
    "clicksSelectors": builderClick("Sociodemographic_economic_characteristics", "default"),
    "delay": 'searchLoad'
  },
  {
    "label": "Search page Remove Symptoms_signs taxo",
    "path": pagePathQuery,
    "clicksSelectors": builderClick("Symptoms_signs", "default"),
    "delay": 'searchLoad'
  }
  ,
  {
    "label": "Search page Clear search",
    "path": pagePathQuery,
    "clickSelector": "div#search-criteria-region table > tbody > tr > td:nth-child(1) a",
    "delay": 'searchLoad'
  }
];

module.exports = scenarios;