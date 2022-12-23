// ==UserScript==
// @name         Pickleball Court script
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  reserve pickleball court
// @author       You
// @match        https://booknow.appointment-plus.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=katycomputer.com
// @require      https://cdn.jsdelivr.net/npm/luxon@3.1.1/build/global/luxon.min.js
// ==/UserScript==

'use strict';

const DateTime = luxon.DateTime;

const COURT_ONE = 'Lexington Colony Pickleball Court 1';
const COURT_TWO = 'Lexington Colony Pickleball Court 2';
const TIMES = ['8:30pm', '9:00pm', '9:30pm'];

let dateTimeNow = () => DateTime.now().setZone('America/Chicago');
let mondayMidnight = () => DateTime.now().setZone('America/Chicago').startOf('week');
let diffMinutes = () => dateTimeNow().diff(mondayMidnight(), 'minutes').toObject().minutes;
let isUnderFiveMinAfterMidnight = () => diffMinutes() < 5 && diffMinutes() >= 0;
let isFiveMinBeforeMidnight = () => diffMinutes() >= 10075;

// These are for testing purposes.
// let mondayMidnight = () => DateTime.fromISO('16:00:00-06:00');
// let isFiveMinBeforeMidnight = () => diffMinutes() < 0 && diffMinutes() > -5;

let courtSelected = () => window.localStorage.getItem('courtSelected') === 'true';
let reservationSelected = () => window.localStorage.getItem('reservationSelected') === 'true';
let dateSelected = () => window.localStorage.getItem('dateSelected') === 'true';
let timeSelected = () => window.localStorage.getItem('timeSelected') === 'true';
let apptFinalized = () => window.localStorage.getItem('apptFinalized') === 'true';
let stop = () => window.localStorage.getItem('stop') === 'true';
let manualRun = () => window.localStorage.getItem('manualRun') === 'true';

let finalizeButton = () => document.querySelectorAll('input[value="Finalize  Appointment "]')[0];
let nextButton = () => document.querySelectorAll('input[value="Next"]')[0];
let appointmentTimesLoaded = () => !!document.getElementsByClassName('appointment-list-header').length;
let courtOneSelected = () => Array.from(document.querySelectorAll('option'))
        .find(el => el.textContent === COURT_ONE).selected;

function reset() {
    window.localStorage.setItem('courtSelected', false);
    window.localStorage.setItem('reservationSelected', false);
    window.localStorage.setItem('dateSelected', false);
    window.localStorage.setItem('timeSelected', false);
    window.localStorage.setItem('apptFinalized', false);
    window.localStorage.setItem('stop', false);
}

function createManualRunButton() {
    let logoutElement = document.getElementById('cv-navtab-item-logOut-id');
    let newButton = '<button type="button" id="run_script_button" style="margin:10px 5px">Run Script</button><span>Clicking this manually runs the script.</span>'
    let div = document.createElement('div');
    div.innerHTML = newButton.trim();
    logoutElement.parentNode.insertBefore(div, logoutElement.nextSibling);
    document.getElementById ("run_script_button").addEventListener (
        "click", manuallyRunScript, false
    );
}

function manuallyRunScript() {
    reset();
    let court = Array.from(document.querySelectorAll('option'))
        .find(el => el.textContent === 'Select Court');
    court.selected = true;
    window.localStorage.setItem('manualRun', true);
    court.parentElement.onchange();
}

function selectCourt(courtName) {
    let court = Array.from(document.querySelectorAll('option'))
        .find(el => el.textContent === courtName);
    court.selected = true;
    window.localStorage.setItem('courtSelected', true);
    court.parentElement.onchange();
}

function selectReservation() {
    let reservation = Array.from(document.querySelectorAll('option'))
        .find(el => el.textContent === '1 1/2 Hour Doubles');
    reservation.selected = true;
    window.localStorage.setItem('reservationSelected', true);
    reservation.parentElement.onchange();
}

function selectDate() {
    let date = Array.from(document.querySelectorAll('[id="cv-leftnav-item-calendar-available-id"]'))
        .find(el => el.textContent == dateTimeNow().plus({ days: 1 }).day);
    if (date) {
        window.localStorage.setItem('dateSelected', true);
        date.click();
    }
}

function selectTime() {
    for (let time of TIMES) {
        let element = Array.from(document.querySelectorAll('td'))
           .find(el => el.textContent === time);

        if (element) {
            window.localStorage.setItem('timeSelected', true);
            element.parentElement.querySelector('form').submit();
            return true;
        }
    }

    return false;
}

function stopRunning() {
    window.localStorage.setItem('stop', true);
    window.localStorage.setItem('manualRun', false);
}

function finalizeAppt() {
    if (finalizeButton()) {
        window.localStorage.setItem('apptFinalized', true);
        stopRunning();
        finalizeButton().click();
    }
}

function continueOrStop() {
    if (nextButton()) {
        nextButton().click();
    } else if (courtOneSelected()) {
        window.localStorage.setItem('dateSelected', false);
        selectCourt(COURT_TWO);
    } else {
        stopRunning();
    }
}

/*
async function waitForLoader() {
    let loader = () => document.getElementsByClassName('loader')[0];
    console.log(window.getComputedStyle(loader()).display)
    while (loader() && window.getComputedStyle(loader()).display === 'block') {
        await new Promise(r => setTimeout(r, 1));
    }
}
*/

function reserveCourt() {
    if (stop()) return;

    if (!courtSelected()) selectCourt(COURT_ONE);
    if (!reservationSelected()) selectReservation();
    if (!dateSelected()) selectDate();
    if (!timeSelected() && appointmentTimesLoaded() && !selectTime()) continueOrStop();
    if (!apptFinalized()) finalizeAppt();
}

createManualRunButton();


if (isUnderFiveMinAfterMidnight() || manualRun()) {
    reserveCourt();
} else if (isFiveMinBeforeMidnight()) {
    reset();
    location.reload();
} else {
    reset();
    setTimeout(() => {
        location.reload();
    }, "60000");
}
