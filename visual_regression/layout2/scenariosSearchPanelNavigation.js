function taxoPanelSelectorClick(group, li){
  return 'meta-taxonomy-filter-panel .panel-group meta-taxonomy-filter-list:nth-child(' + group + //
    ') > div > div.panel-collapse > div.panel-body > ul > li:nth-of-type(' + li + //
    ') > a';
}

function resultTableSelectorClick(li){
  return 'entity-counts > ul > li:nth-child(' + li + ') > a';
}

var scenarios = [
  {
    "label": "Search page - taxo panel Mlstr_area",
    "path": "/mica/repository#/search",
    "clickSelector": taxoPanelSelectorClick(1, 1),
    "delay": 'delayOnPage'
  },
  {
    "label": "Search page - taxo panel Mlstr_Source/target",
    "path": "/mica/repository#/search",
    "clickSelector": taxoPanelSelectorClick(1, 2),
    "delay": 'delayOnPage'
  },
  {
    "label": "Search page - taxo panel Mica_variable properties",
    "path": "/mica/repository#/search",
    "clickSelector": taxoPanelSelectorClick(1, 3),
    "delay": 'delayOnPage'
  },
  {
    "label": "Search page - taxo panel Mica_dataset properties",
    "path": "/mica/repository#/search",
    "clickSelector": taxoPanelSelectorClick(2, 1),
    "delay": 'delayOnPage'
  },
  {
    "label": "Search page - taxo panel Mica_study properties",
    "path": "/mica/repository#/search",
    "clickSelector": taxoPanelSelectorClick(3, 1),
    "delay": 'delayOnPage'
  },
  {
    "label": "Search page - taxo panel Mica_network properties",
    "path": "/mica/repository#/search",
    "clickSelector": taxoPanelSelectorClick(4, 1),
    "delay": 'delayOnPage'
  },
  {
    "label": "Search page - Taxo panel Mlstr_area opened - Click datasets",
    "path": "/mica/repository#/search",
    "clicksSelectors": [taxoPanelSelectorClick(1, 1), resultTableSelectorClick(1)],
    "delay": 'searchLoad'
  },
  {
    "label": "Search page Sociodemographic_economic_age",
    "path": "/mica/repository#/search",
    "clicksSelectors": [taxoPanelSelectorClick(1, 1), "vocabulary-filter-detail:nth-child(1) terms-vocabulary-filter-detail > div:nth-child(1) div.checkbox > label", resultTableSelectorClick(1)],
    "delay": 'searchLoad'
  },
  {
    "label": "Search page filter age in Areas of information",
    "path": "/mica/repository#/search",
    "clickSelector": taxoPanelSelectorClick(1, 1),
    "inputText": {
      "selector" : "input.input-search-filter",
      "text": "age"
    },
    "delay": 'searchLoad'
  },
  {
    "label": "Search page filter participant in target and source",
    "path": "/mica/repository#/search",
    "clickSelector": taxoPanelSelectorClick(1, 2),
    "inputText": {
      "selector" : "input.input-search-filter",
      "text": "participant"
    },
    "delay": 'searchLoad'
  }

];

module.exports = scenarios;