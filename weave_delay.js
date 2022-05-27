"use strict";

const throttleTime = 150;
const reports = {};
const apikey = "6e350c0a7ff8fbafa62f57069aabd33b";

let nextRequestTime = 0;

function getParameterByName(name, url = window.location.href) {
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

function printError(e) {
    console.log(e);
    alert("Error:\n" + e + "\n\nRefresh the page to start again.");
}

function sleep(ms) {
    return new Promise(f => setTimeout(f, ms));
}

//function to resolve any API requests
async function fetchWCLv1(path) {
    //ensures that requests are not too fast
    console.log("fetching data from WCL....");
    let t = (new Date).getTime();
    nextRequestTime = Math.max(nextRequestTime, t);
    let d = nextRequestTime - t;
    nextRequestTime += throttleTime;
    await sleep(d);
    console.assert(path.length < 1900, "URL may be too long: " + path);
    let response = await fetch(`https://www.warcraftlogs.com:443/v1/${path}api_key=${apikey}`);
    if (!response) {
        throw "Could not fetch " + path;
    }
    if (response.status != 200) {
        if (response.type == "cors") {
            throw "Fetch error. Warcraftlogs may be down or logs private.";
        }
        throw "Fetch error.";
    }
    let json = await response.json();
    return json;
}

class Report {

    constructor(reportId, playerName) {
        this.reportId = reportId;
        this.playerName = playerName;
        this.plotData = {};
    }

    async fetchData() {
        console.log("inside fetchData...");
        if ("data" in this) {
            ("data exists, returning...");
            return;
        }
        this.friendlies = {};
        this.data = await fetchWCLv1(`report/fights/${this.reportId}?`);
        console.log("done getting data");
        for (let friendlies of this.data.friendlies) {
            this.friendlies[friendlies.name] = friendlies.id;
        }
        this.fetchCasts();
    }

    async fetchCasts() {
        console.log("inside fetchCasts...");
        if ("casts" in this) {
            console.log("casts exists, returning...");
            return;
        }
        enableInput(false);
        this.casts = {};
        let source = this.friendlies[this.playerName];
        if (source == undefined) {
            enableInput(true);
            printError("The player defined is not part of the combat log.");
            location.href = location.origin + location.pathname + `?id=${getParameterByName("id")}`;
            return;
        }

        for (let fight of this.data.fights) {
            if (fight.boss != 0) {
                this.casts[fight.id] = await fetchWCLv1(`report/events/casts/${this.reportId}?start=${fight.start_time}&end=${fight.end_time}&sourceid=${source}&options=66&`);
            }
        }
        console.log("done in casts");
        enableInput(true);
        selectFight();
    }

    doMath(fightId, start_time, name) {
        //this removes any ability in blacklist from the cast list, also removes any windfury proccs
        let blacklist = ["Dark Rune", "Readiness", "Restore Mana", "Dire Drunkard", "Kill Command", "Hunter's Mark", "Bestial Wrath", "Blood Fury", "Lust for Battle", "Rapid Fire", "Haste"];
        let melee_list = ["Melee", "Raptor Strike"];

        for (let i = 0; i < this.casts[fightId].events.length; i++) {
            if (blacklist.includes(this.casts[fightId].events[i].ability.name)) {
                this.casts[fightId].events.splice(i, 1);
                i--;
            }
            else if (this.casts[fightId].events[i].ability.name == "Melee") {
                if (melee_list.includes(this.casts[fightId].events[i - 1].ability.name)) {
                    this.casts[fightId].events.splice(i - 1, 1);
                    i--;
                }
            }
        }

        let timestamps_weave = [];
        let ability_weave_time = [];
        let weave_ability_time = [];

        //calculates the difference in time between weaves and abilities
        for (let i = 0; i < this.casts[fightId].events.length; i++) {
            let cast = this.casts[fightId].events[i];
            if ((cast.ability.name == "Melee" || cast.ability.name == "Raptor Strike") && i >= 1 && i < this.casts[fightId].events.length - 1) {
                timestamps_weave.push((cast.timestamp - start_time) / 1000);
                ability_weave_time.push(cast.timestamp - this.casts[fightId].events[i - 1].timestamp);
                weave_ability_time.push(this.casts[fightId].events[i + 1].timestamp - cast.timestamp);
            }
        }

        let total_weave_time = [];
        for (let i = 0; i < ability_weave_time.length; i++) {
            total_weave_time.push(ability_weave_time[i] + weave_ability_time[i]);
        }

        //draws the plots
        show("plot");
        d3.selectAll("svg > *").remove();
        let x_limit = (this.casts[fightId].events[this.casts[fightId].events.length - 1].timestamp - start_time) / 1000 + 10;
        drawPlot(timestamps_weave, ability_weave_time, x_limit, 2500, "#svg1", "Ability to weave time on " + name);
        drawPlot(timestamps_weave, weave_ability_time, x_limit, 2500, "#svg2", "Weave to ability time on " + name);
        drawPlot(timestamps_weave, total_weave_time, x_limit, 4000, "#svg3", "Total weave time on " + name);
    }



}

//draws the graphs
function drawPlot(x_data, y_data, x_limit, y_limit, svg_id, title) {

    //calculate average

    let average = (y_data.reduce((a, b) => a + b, 0) / y_data.length) || 0;
    average = average.toFixed(1);

    var svg = d3.select(svg_id),
        margin = 100,
        width = svg.attr("width") - margin - 20, //400
        height = svg.attr("height") - margin //300

    var xScale = d3.scaleLinear().domain([0, x_limit]).range([0, width]),
        yScale = d3.scaleLinear().domain([0, y_limit]).range([height, 0]);

    // Title
    svg.append('text')
        .attr('x', width / 2 + 50)
        .attr('y', 40)
        .attr('text-anchor', 'middle')
        .style('font-family', 'Helvetica')
        .style('font-size', 20)
        .text(title);

    // X label
    svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('transform', 'translate(' + svg.attr("width") / 2 + ', ' + (svg.attr("height") - 15) + ')')
        .style('font-family', 'Helvetica')
        .style('font-size', 12)
        .text('Time in seconds');

    // Y label
    svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('transform', 'translate(20,' + svg.attr("height") / 2 + ')rotate(-90)')
        .style('font-family', 'Helvetica')
        .style('font-size', 12)
        .text('Time in milliseconds');

    //average label 
    svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('transform', 'translate(' + (svg.attr("width") - 55) + ', ' + (svg.attr("height") - 6) + ')')
        .style('font-family', 'Helvetica')
        .style('font-size', 12)
        .text("avg. time = " + average);

    var g = svg.append("g")
        .attr("transform", "translate(" + 70 + "," + 50 + ")");

    g.append("g")
        .attr("transform", "translate(-10," + (height) + ")")
        .call(d3.axisBottom(xScale));

    g.append("g")
        .attr("transform", "translate(-10,0)")
        .call(d3.axisLeft(yScale).ticks(5));

    //values
    svg.append('g')
        .selectAll("dot")
        .data(d3.zip(x_data, y_data))
        .enter()
        .append("circle")
        .attr("cx", function (d) { return xScale(d[0]); })
        .attr("cy", function (d) { return yScale(d[1]); })
        .attr("r", 4)
        .attr("transform", "translate(" + 60 + "," + 50 + ")")
        .style("fill", "#0000FF");
}

function selectReport() {

    let wcl = getParameterByName('id');
    let player = getParameterByName('player');
    let el = document.querySelector("#code");
    let el_playerSelect = document.querySelector("#pname");
    let el_fightSelect = document.querySelector("#fightSelect");

    let playerParam = el_playerSelect === null ? "" : "&player=" + el_playerSelect.value.charAt(0).toUpperCase() + el_playerSelect.value.slice(1);;
    //TODO: making URL instant load copied fight
    //let fightParam = el_fightSelect === null ? "" : "&fight=" + el_fightSelect.value;

    el_fightSelect.innerHTML = "";
    let reportId = el.value;

    if (!wcl || wcl !== reportId || !player || player !== el_playerSelect.value) {
        //TODO: look above
        //location.href = location.origin + location.pathname + '?id=' + el.value + playerParam + fightParam;
        location.href = location.origin + location.pathname + '?id=' + el.value + playerParam;
        return;
    }

    let urlmatch = reportId.match(/https:\/\/(?:[a-z]+\.)?(?:classic\.|www\.)?warcraftlogs\.com\/reports\/((?:a:)?\w+)/);
    if (urlmatch) reportId = urlmatch[1];

    //checks if the entered id is valid => otherwise red border
    if (!reportId || reportId.length !== 16 && reportId.length !== 18) {
        el.style.borderColor = "red";
        return;
    }
    //resets color
    el.style.borderColor = null;
    console.log("checking after");
    if (!(reportId in reports)) reports[reportId] = new Report(reportId, getParameterByName('player'));
    reports[reportId].fetchData().then(() => {
        console.log("Starting to add the fights....");
        for (let fight of reports[reportId].data.fights) {
            if (fight.boss != 0) {
                let el_f = document.createElement("option");
                el_f.value = reportId + ";" + fight.id + ";" + fight.start_time + ";" + fight.name;
                el_f.textContent = fight.name + " - " + fight.id;
                el_fightSelect.appendChild(el_f);
            }
        }
    }).catch(printError);

}

function enableInput(enable = true) {
    let a = ["input", "button", "select"].map(s => document.querySelectorAll(s));
    for (let b of a) {
        for (let el of b) {
            el.disabled = !enable;
        }
    }
}

function selectFight(index) {
    console.log("selecting Fight....");
    let el = document.querySelector("#fightSelect");
    let i;
    if (index)
        i = index;
    else
        i = el.selectedIndex;
    if (i === -1) return;
    let information = el.options[i].value;
    let [reportId, fightId, start_time, name] = information.split(";");
    reports[reportId].doMath(fightId, start_time, name);
}