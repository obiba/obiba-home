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
    "clicksSelectors": [taxoPanelSelectorClick(1, 1), "#term-Sociodemographic_economic_characteristics-0", resultTableSelectorClick(1)],
    "delay": 'searchLoad'
  }
];

module.exports = scenarios;