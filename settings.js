//stores settings

function saveSettings() {
    localStorage.setItem("instants", document.getElementById("instants").checked);
    localStorage.setItem("outliers", document.getElementById("outliers").value);
    localStorage.setItem("y12", document.getElementById("y12").value);
    localStorage.setItem("y3", document.getElementById("y3").value);



    console.log("local storage");
    for (let i = 0; i < localStorage.length; i++) {
        console.log(localStorage.key(i) + "=[" + localStorage.getItem(localStorage.key(i)) + "]");
    }
    selectFight();
}

function restoreDefaults() {
    localStorage.setItem("instants", true);
    document.getElementById("instants").checked = true;
    localStorage.setItem("y12", 2500);
    document.getElementById("y12").value = 2500;
    localStorage.setItem("y3", 4000);
    document.getElementById("y3").value = 4000;
    localStorage.setItem("outliers", 5000);
    document.getElementById("outliers").value = 5000;

    console.log("local storage");
    for (let i = 0; i < localStorage.length; i++) {
        console.log(localStorage.key(i) + "=[" + localStorage.getItem(localStorage.key(i)) + "]");
    }
    selectFight();
}

function loadSettings() {
    if (localStorage.getItem("instants") == undefined) {
        localStorage.setItem("instants", true);
    }
    if (localStorage.getItem("y12") == undefined) {
        localStorage.setItem("y12", 2500);
    }
    if (localStorage.getItem("y3") == undefined) {
        localStorage.setItem("y3", 4000);
    }
    if (localStorage.getItem("outliers") == undefined) {
        localStorage.setItem("outliers", 5000);
    }
    document.getElementById("instants").checked = localStorage.getItem("instants");
    document.getElementById("y12").value = localStorage.getItem("y12");
    document.getElementById("y3").value = localStorage.getItem("y3");
    document.getElementById("outliers").value = localStorage.getItem("outliers");
}