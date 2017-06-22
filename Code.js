var NAME = 'Roster Generator'

var NUKE_SHEETS = true;

function onInstall(e) {
    onOpen();
}

function onOpen() {
    SpreadsheetApp.getUi() // Or DocumentApp or FormApp.
	.createMenu('Generate Rosters')
	.addItem('Show '+NAME, 'showSidebar')
	.addItem('Test Distribute Students', 'testDistributeStudentsFromSheet')
	.addItem('Test All','testAll')
	.addToUi();
}

function ColorMaker () {  
    var COLORS = ['#F8BBD0','#E1BEE7','#BBDEFB','#FFE0B2','#F5F5F5','#FFCCBC','#D7CCC8','#FFF9C4'];
    var colorIndex = 0;
    var colordict = {};
    var obj = {  
	getColordict : function () { return colordict},
	getColor : function (key) {
	    if (colordict[key]) {return colordict[key]}
	    else {
		colordict[key] = COLORS[colorIndex];
		colorIndex += 1;
		if (colorIndex >= COLORS.length) { colorIndex = 0};
		return colordict[key];
	    }
	}
    }
    return obj
}

colorMaker = ColorMaker();

// Convenience functions
function appendToKey (d, k, v) {
    if (d[k]) {
	d[k].push(v)
    }
    else {
	d[k] = [v]
    }  
}

function makeNewSheet (ss, name) {
    // make a new sheet with name -- append number as needed
    if (ss.getSheetByName(name)) {
	if (NUKE_SHEETS) {
	    var ret = ss.getSheetByName(name);
	    ret.clearContents();
	    return ret;
	}
	incrementer = 1;
	while (ss.getSheetByName(name+'-'+incrementer)) {incrementer += 1};
	name = name + '-' + incrementer;
    }
    return ss.insertSheet(name)
}

/* From http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array */
/**
 * Randomize array element order in-place.
 * Using Durstenfeld shuffle algorithm.
 */
function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}

// end convenience functions

/* BEGIN MAIN STUFF */

function getData () {
    var range = SpreadsheetApp.getActiveSheet().getDataRange();
    var data = Table(range);
    return cleanupObject(data);
}

function buildDataStructure (sortBy, groupings, distributions, sheet) {
    Logger.log('Build data structure: %s, %s, %s',JSON.stringify(sortBy),JSON.stringify(groupings),JSON.stringify(distributions));
    if (! sheet) {
	var sheet = SpreadsheetApp.getActiveSheet();
    }
    Logger.log('Data='+sheet.getDataRange().getLastRow()+'x'+sheet.getDataRange().getLastColumn());
    var studentData = Table(sheet.getDataRange()); 
    var groups = {}
    Logger.log("Looking @ %s",JSON.stringify(groupings));
    for (var groupKey in groupings) {
	Logger.log('Key: %s',groupKey);
	Logger.log('Val: %s',groupings[groupKey]);
	var ngroups = groupings[groupKey]
	Logger.log('Setting up data structure for %s,%s',groupings[groupKey],groupKey);
	groupKey = ''+groupKey;
	groups[groupKey] = {};
	groups[groupKey].distributionChart = {};
	groups[groupKey].ngroups = ngroups
	groups[groupKey].lastDealt = 0; // keep track of who got the last one
	groups[groupKey].piles = []; // for dealing out
	for (var i=0;  i<ngroups; i++) {
	    groups[groupKey].piles.push([]);
	}
	Logger.log('==>',JSON.stringify(groups));
    }
    for (var i=1; i<studentData.length; i++) {
	var row = studentData[i]
	//Logger.log('row '+i);
	if (row) {
	    if (!sortBy) {
		var group = groups['ALL']
	    }
	    else {
		var group = groups[row[sortBy]]
	    }
	    if (! group) {
		//Logger.log('WTF, no group for: '+row+'=>sortBy=>'+row[sortBy]);
		var group = groups[""+row[sortBy]];
		//Logger.log('Try string version of key: '+row[sortBy]+"");
	    }
	    if (group) {
		var key = ""
		distributions.forEach(function (k) {
		    if (key) { key += '-' }
		    key += row[k] // build a key -- e.g. gender + sped status
		}
				     ) // end build key...
		row.key = key
		//Logger.log('adding row '+key+'to'+JSON.stringify(group));
		appendToKey(group.distributionChart, key, row)
	    } // if we have a group
	    else {
		Logger.log('skipping row'+key+'=>'+row+'group=>'+group)
	    } // if something is weird      
	} // end if row
    } // end for loop
    Logger.log('returning groups! %s',groups);
    return groups;
}

function distributeStudents (sortBy, groupings, distributions, sheet) {
    Logger.log('We got groups: %s',groupings);
    for (var g in groupings) {
	Logger.log('%s => %s',g,groupings[k]);
    }
    groups = buildDataStructure(sortBy, groupings, distributions, sheet);
    for (var groupKey in groups) {
	var group = groups[groupKey];
	Logger.log('group='+JSON.stringify(group));
	if (! sheet ) {
	    var sheet = SpreadsheetApp.getActiveSheet();      
	}
	var ss = sheet.getParent()    
	var outputSheet = makeNewSheet(ss,groupKey);
	for (var distroGroup in group.distributionChart) {
	    var rowsToDeal = group.distributionChart[distroGroup];
	    shuffleArray(rowsToDeal); 
	    rowsToDeal.forEach(function (row) {
		group.lastDealt += 1
		if (group.lastDealt >= group.ngroups) { group.lastDealt = 0; } // iterate through groups
		//Logger.log('Add to pile: '+group.lastDealt+'of'+JSON.stringify(group.piles));
		
		var pile = group.piles[group.lastDealt]
		//Logger.log('push row onto pile'+pile);
		if (!pile) {
		    Logger.log('VERY STRANGE: NO PILE FOR %s (%s)',row,pile);
		    Logger.log('Aiming to add to pile #%s of %s (actually have %s)',group.lastDealt,group.ngroups,group.piles.length);
		}
		else {
		    pile.push(row)
		}
	    });
	}
	//Logger.log('PILES');
	//Logger.log(group.piles);
	var colnum = 1;
	group.piles.forEach(
	    function (pile) {
		toWrite = pile.map(
		    function (row) {
			return [row.Name];
		    }
		); // end pile.map
		colors = pile.map(
		    function (row) {
			return [colorMaker.getColor(row.key)]
		    }
		)
		if (toWrite.length==0) { return }
		try {
		    outputSheet.getRange(1,colnum, toWrite.length, 1).setValues(
			toWrite
		    );
		}
		catch (err) {
		    Logger.log('Error writing '+toWrite+' of length '+toWrite.length);
		    throw err
		}         
		//Logger.log('set colors: '+JSON.stringify(colors));
		outputSheet.getRange(1,colnum,toWrite.length, 1).setBackgrounds(
		    colors
		);
                
		colnum += 1;
	    }
	); // end forEach pile
	
    } // end for loop
    // Output key...
    keySheet = makeNewSheet(ss,'KEY')
    var cd = colorMaker.getColordict();
    var i = 1;
    for (var key in cd) {
	var color = cd[key]
	var range = keySheet.getRange(i,1,1,1);
	i+=1;
	range.setValue(key)
	range.setBackground(color)
    }
    Logger.log('GROUPS');
    Logger.log(groups);
}

function clearDataSheets (groupings, ss) {
    if (! ss) {
	var ss = SpreadsheetApp.getActiveSpreadsheet();
    }
    for (var g in groupings) {
	ss.getSheets().forEach( function (sheet) {
	    Logger.log('Check sheet '+sheet.getName())
	    if (sheet.getName().indexOf(g)==0) {
		Logger.log('Delete!');
		ss.deleteSheet(sheet)
	    }
	});
    }
}

function testAll () {
    distributeStudents(
	'',
	{'ALL':30},
	    ['Gender','IEPor504']
    );    
}

function testDistributeStudents ( ) {
    distributeStudents(
	'YOG',
	    {'2017':7,
	     '2018':8,
	     '2019':8,
	     '2020':10},
	    ['IEPor504','Gender'],
	    SpreadsheetApp.openById("1sNajyj9F5pDJ8UmMQAimU6FXWYBo578hESmHCbMK800").getActiveSheet()
    )
}

function testBuildDataStructure () {
    buildDataStructure(
	'YOG',
	{'2017':7,
	 '2018':8,
	 '2019':8,
	 '2020':10},
	['IEPor504','Gender'],
	SpreadsheetApp.openById("1sNajyj9F5pDJ8UmMQAimU6FXWYBo578hESmHCbMK800").getActiveSheet()
    )
}

function testClearDataSheets () {
    clearDataSheets(
	{'2017':7,
	 '2018':8,
	 '2019':8,
	 '2020':10},
	SpreadsheetApp.openById("1sNajyj9F5pDJ8UmMQAimU6FXWYBo578hESmHCbMK800")
    )
}

function testDistributeStudentsFromSheet ( ) {
    distributeStudents(
	'YOG',
	{
	    2017:7,
	    2018:8,
	    2019:8,
	    2020:10},
	['IEPor504','Gender']
    )
}
function showSidebar () {
    //ui = HtmlService.createHtmlOutputFromFile('Sidebar');
    ui = HtmlService.createTemplateFromFile('Sidebar').evaluate().setTitle(NAME);
    SpreadsheetApp.getUi()
	.showSidebar(ui)
}

function include(filename) { 
    return HtmlService.createTemplateFromFile(filename)
	.evaluate().getContent();
}

function doGet() {
    var html = HtmlService.createTemplateFromFile('WEBAPPFILE.HTML');
    return html.evaluate().setSandboxMode(HtmlService.SandboxMode.IFRAME);
}


function cleanupObject (o) {
    if (o.toGMTString) {return o.toGMTString()}
    if (Array.isArray(o)) {return o.map(cleanupObject)}
    if (o.call) {return undefined} // null out functions
    if (typeof(o)=='object') {
	var newObj = {}
	for (var k in o) {
            newObj[k] = cleanupObject(o[k])
	}
	return newObj
    }
    if (['string','number'].indexOf(typeof(o))>-1) {return o}
    else {
	return undefined
    }
}
