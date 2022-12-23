// ==UserScript==
// @name         Pickleball Court script
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  reserve pickleball court
// @author       You
// @match        https://booknow.appointment-plus.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=katycomputer.com
// @require      https://cdn.jsdelivr.net/npm/luxon@3.1.1/build/global/luxon.min.js
// @require      https://unpkg.com/js-datepicker
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.6.1/jquery.min.js
// @require      https://cdn.jsdelivr.net/npm/timepicker@1.14.0/jquery.timepicker.min.js
// @resource     DATEPICKER_CSS https://unpkg.com/js-datepicker/dist/datepicker.min.css
// @resource     TIMEPICKER_CSS https://cdn.jsdelivr.net/npm/timepicker@1.14.0/jquery.timepicker.css
// @grant        GM_getResourceText
// @grant        GM_addStyle
// ==/UserScript==

'use strict';

const DateTime = luxon.DateTime;

// Time methods
let dateTimeNow = () => DateTime.now().setZone('America/Chicago');
let selectedDate = () => DateTime.fromISO(window.localStorage.getItem('selectedDate')) || dateTimeNow().startOf('week').plus({ days: 8 });
let dayBeforeSelectedDate = () => selectedDate().minus({ days: 1 });
let diffMinutes = () => dateTimeNow().diff(selectedDate(), 'minutes').toObject().minutes;
let isUnderFiveMinAfterMidnight = () => diffMinutes() < 5 && diffMinutes() >= 0;
let isFiveMinBeforeMidnight = () => diffMinutes() >= 10075;

// Local Storage
let courtSelected = () => window.localStorage.getItem('courtSelected') === 'true';
let reservationSelected = () => window.localStorage.getItem('reservationSelected') === 'true';
let dateSelected = () => window.localStorage.getItem('dateSelected') === 'true';
let timeSelected = () => window.localStorage.getItem('timeSelected') === 'true';
let apptFinalized = () => window.localStorage.getItem('apptFinalized') === 'true';
let stop = () => window.localStorage.getItem('stop') === 'true';
let manualRun = () => window.localStorage.getItem('manualRun') === 'true';
let selectedTimes = () => window.localStorage.getItem('times') ? window.localStorage.getItem('times').split(',') : [];
let selectedTimesFiltered = () => selectedTimes().filter(n => n);
let selectedCourts = () => window.localStorage.getItem('courts') ? window.localStorage.getItem('courts').split(',') : [];
let selectedCourtsFiltered = () => selectedCourts().filter(n => n);
let selectedDuration = () => window.localStorage.getItem('selectedDuration') ?? 0;

// Elements
let finalizeButton = () => document.querySelectorAll('input[value="Finalize  Appointment "]')[0];
let nextButton = () => document.querySelectorAll('input[value="Next"]')[0];
let previousButton = () => document.querySelectorAll('input[value="Previous"]')[0];
let timesTable = () => document.getElementsByClassName("appointment-list-style")[0];
let loginButton = () => document.querySelectorAll('input[value="Log In"]')[0];
let loginForm = () => document.querySelectorAll('form[name="auth_form"]')[0];
let usernameInput = () => document.querySelectorAll('input[name="loginname"]')[0];

// Element methods
let appointmentTimesLoaded = () => !!document.getElementsByClassName('appointment-list-header').length;
let lastTimeNotChecked = () => window.localStorage.getItem(`time_checked_${selectedTimesFiltered().length}`) !== 'true';
let lastTimeChecked = () => window.localStorage.getItem(`time_checked_${selectedTimesFiltered().length}`) === 'true';

function resetTimes() {
    [...Array(3)].forEach((item, i) => {
        let index = i+1;
        window.localStorage.setItem(`time_checked_${index}`, false);
    });
}

function stopRunning() {
    window.localStorage.setItem('stop', true);
    window.localStorage.setItem('manualRun', false);
}

function resetCourts() {
    selectedCourtsFiltered().forEach((item, i) => {
        let index = i+1;
        window.localStorage.setItem(`court_checked_${index}`, false);
    });
}

function reset() {
    window.localStorage.setItem('courtSelected', false);
    window.localStorage.setItem('reservationSelected', false);
    window.localStorage.setItem('dateSelected', false);
    window.localStorage.setItem('timeSelected', false);
    window.localStorage.setItem('apptFinalized', false);
    window.localStorage.setItem('stop', false);
    window.localStorage.setItem('manualRun', false);
    resetTimes();
    resetCourts();
}

function resetForNextCourt() {
    window.localStorage.setItem('timeSelected', false);
    window.localStorage.setItem('dateSelected', false);
    resetTimes();
}

function createManualRunButton() {
    let logoutElement = document.getElementById('cv-navtab-item-logOut-id');
    let newButton = '<button type="button" id="run_script_button" style="margin: 20px 5px 10px 5px">Run Script</button><span>Clicking this manually runs the script.</span>'
    let div = document.createElement('div');
    div.setAttribute("id", "run_script");
    div.innerHTML = newButton.trim();
    logoutElement.parentNode.insertBefore(div, logoutElement.nextSibling);
    document.getElementById ("run_script_button").addEventListener (
        "click", manuallyRunScript, false
    );
}

function addDatePicker() {
    let runButtonElement = document.getElementById('run_script');
    let datepickerElement = '<span style="margin: 10px 10px">Pick Date</span><input type="text" id="date_picker_input" style="margin: 10px 0px">';
    let div = document.createElement('div');
    div.setAttribute("id", "date_picker");
    div.innerHTML = datepickerElement.trim();
    runButtonElement.parentNode.insertBefore(div, runButtonElement.nextSibling);

    datepicker('#date_picker_input', {
        onSelect: (instance, date) => {
            window.localStorage.setItem('selectedDate', DateTime.fromJSDate(date).toISO());
        },
        dateSelected: selectedDate().toJSDate(),
    });
}

function addTimePicker() {
    let datepickerElement = document.getElementById('date_picker');
    let div = document.createElement('div');
    let note = '<span style="margin: 10px 10px">Times are by priority.</span>';
    div.setAttribute("id", "time_picker");
    div.innerHTML += note.trim();
    [...Array(3)].forEach((item, i) => {
        let index = i+1;
        let timepickerElement = `<span style="margin: 10px 10px">Pick Time #${index}</span><input type="text" id="time_picker_input_${index}" style="margin: 10px 0px">`;
        div.innerHTML += timepickerElement.trim();
    });
    datepickerElement.parentNode.insertBefore(div, datepickerElement.nextSibling);

    [...Array(3)].forEach((item, i) => {
        let index = i+1;
        $(`#time_picker_input_${index}`).timepicker({
            minTime: '7:00am',
            maxTime: '9:30pm',
        });
        $(`#time_picker_input_${index}`).timepicker('setTime', selectedTimes()[i]);
        $(`#time_picker_input_${index}`).on('changeTime', function() {
            let time = $(this).val()
            let existingTimes = selectedTimes();
            existingTimes[i] = time;
            window.localStorage.setItem('times', existingTimes.join(','));
        });
    });
}

function addCourtPicker() {
    let timePickerElement = document.getElementById('time_picker');
    let div = document.createElement('div');
    div.setAttribute("style", "margin: 10px 0px 20px 0px");
    let note = '<div style="text-decoration: underline; font-weight: bold;">Select Courts</div>';
    div.innerHTML += note.trim();
    div.setAttribute("id", "court_picker");
    let select = document.querySelectorAll('select[name="e_id"]')[0];
    let courts = Array.from(select.querySelectorAll('option'))
        .reduce((filtered, el) => {
            if (Number.isInteger(parseInt(el.value))) {
                filtered.push(el.textContent);
            }
            return filtered;
        }, []);
    courts.forEach((court, i) => {
        let index = i+1;
        let courtElement = `<div>
            <input id="court_picker_input_${index}"type="checkbox" />
            <span class="state">
                <label>${court}</label>
            </span>
         </div>`;
         div.innerHTML += courtElement.trim();
    });
    timePickerElement.parentNode.insertBefore(div, timePickerElement.nextSibling);

    courts.forEach((court, i) => {
        let index = i+1;
        document.getElementById(`court_picker_input_${index}`).checked = selectedCourts()[i];
        $(`#court_picker_input_${index}`).change(function() {
            let existingCourts = selectedCourts();
            existingCourts[i] = this.checked ? courts[index-1] : '';
            document.getElementById(`court_picker_input_${index}`).checked = this.checked;
            window.localStorage.setItem('courts', existingCourts.join(','));
        });
    });
}

function addDurationSelect() {
    let courtPickerElement = document.getElementById('court_picker');
    let div = document.createElement('div');
    let note = '<span style="margin-right: 10px">Select Duration (must choose one)</span>';
    div.innerHTML += note.trim();
    div.setAttribute("style", "margin: 10px 0px 20px 0px");
    div.setAttribute("id", "duration_select");
    let element = `
        <select id="duration_picker">
            <option value="0">Make selection</option>
            <option value="1">1 hour</option>
            <option value="2">1 1/2 hour</option>
        </select>`;
    div.innerHTML += element.trim();
    courtPickerElement.parentNode.insertBefore(div, courtPickerElement.nextSibling);

    let select = document.getElementById('duration_picker');
    select.value = selectedDuration();
    $(`#duration_picker`).change(function() {
        window.localStorage.setItem('selectedDuration', this.value);
    });
}

function addCss() {
    const datepickerCss = GM_getResourceText("DATEPICKER_CSS");
    const timepickerCss = GM_getResourceText("TIMEPICKER_CSS");

    GM_addStyle(datepickerCss);
    GM_addStyle(timepickerCss);
}

function manuallyRunScript() {
    reset();
    let court = Array.from(document.querySelectorAll('option'))
        .find(el => el.textContent === 'Select Court');
    court.selected = true;
    window.localStorage.setItem('manualRun', true);
    court.parentElement.onchange();
}

function selectCourt() {
    let [courtName, index] = courtBeingChecked();
    window.localStorage.setItem(`court_checked_${index}`, true);
    let court = Array.from(document.querySelectorAll('option'))
        .find(el => el.textContent === courtName);
    court.selected = true;
    window.localStorage.setItem('courtSelected', true);
    court.parentElement.onchange();
}

function selectReservation() {
    let duration = selectedDuration();
    if (!duration || duration === '0') return;

    let name = parseInt(duration) === 1 ? '1 Hour Singles' : '1 1/2 Hour Doubles';
    let reservation = Array.from(document.querySelectorAll('option'))
        .find(el => el.textContent === name);
    reservation.selected = true;
    window.localStorage.setItem('reservationSelected', true);
    reservation.parentElement.onchange();
}

function selectDate() {
    let date = Array.from(document.querySelectorAll('[id="cv-leftnav-item-calendar-available-id"]'))
        .find(el => el.textContent == selectedDate().day);
    if (date) {
        window.localStorage.setItem('dateSelected', true);
        date.click();
        return;
    }
    alert('Date chosen is not yet available.');
    stopRunning();
}

function timeBeingChecked() {
    for (let [i, time] of selectedTimesFiltered().entries()) {
        let index = i+1;
        if (window.localStorage.getItem(`time_checked_${index}`) === 'true') continue;
        return [time, index];
    }
    return [];
}

function courtBeingChecked() {
    for (let [i, court] of selectedCourtsFiltered().entries()) {
        let index = i+1;
        if (window.localStorage.getItem(`court_checked_${index}`) === 'true') continue;
        return [court, index];
    }
    return [];
}


function selectTime() {
    let [time, index] = timeBeingChecked();

    if (!time) return false;
    if (!timesTable().rows.length) {
        window.localStorage.setItem(`time_checked_${index}`, true);
        selectDate();
        return true;
    }

    let element = Array.from(document.querySelectorAll('td'))
        .find(el => el.textContent === time);

    if (element) {
        window.localStorage.setItem('timeSelected', true);
        window.localStorage.setItem(`time_checked_${index}`, true);
        element.parentElement.querySelector('form').submit();
        return true;
    }

    return false;
}

function nextOrPrevious() {
    let [time, index] = timeBeingChecked();

    let times = Array.from(timesTable().querySelectorAll('td[align="center"]')).map(el => DateTime.fromFormat(el.textContent, 'h:mma'))
    let first = times[0];
    let last = times[times.length-1];
    let timeConverted = DateTime.fromFormat(time, 'h:mma');

    if (timeConverted < first && previousButton()) {
        previousButton().click();
        return true;
    }

    if (timeConverted > last && nextButton()) {
        nextButton().click();
        return true;
    }

    return false;
}

function finalizeAppt() {
    if (finalizeButton()) {
        window.localStorage.setItem('apptFinalized', true);
        stopRunning();
        finalizeButton().click();
    }
}

function continueOrStop() {
    let [court, index] = courtBeingChecked();
    if (lastTimeChecked() && court) {
        window.localStorage.setItem('courtSelected', false);
        resetForNextCourt();
        reserveCourt();
        return;
    }
    if (lastTimeChecked()) return;
    if (nextOrPrevious()) return;
    if (timeBeingChecked().length) {
        window.localStorage.setItem(`time_checked_${timeBeingChecked()[1]}`, true);
        reserveCourt();
        return;
    }

    stopRunning();
}

function checkForError() {
    let errorElement = Array.from(document.querySelectorAll('font'))
        .find(el => el.textContent === 'Reservation requires more time than the selected time slot allows, please select another time.');
    if (!errorElement) return false;

    window.localStorage.setItem('timeSelected', false);
    if (lastTimeNotChecked()) {
        errorElement.remove();
        reserveCourt();
        return false;
    }
    return true;
}

function checkForMissingFormData() {
    let duration = selectedDuration();

    if (!selectedTimesFiltered().length) {
        alert('No times specified.');
        stopRunning();
        return true;
    }
    if (!duration || duration === '0') {
        alert('Please select duration.');
        stopRunning();
        return true;
    };
    if (!selectedDate()) {
        alert('No date specified.');
        stopRunning();
        return true;
    }
    if (!selectedCourtsFiltered().length) {
        alert('No courts selected.');
        stopRunning();
        return true;
    }
    if (!selectedTimesFiltered().length) {
        alert('No times specified.');
        stopRunning();
        return true;
    }

    return false;
}


function reserveCourt() {
    if (checkForMissingFormData()) return;
    if (stop()) return;

    if (!courtSelected() && courtBeingChecked().length) {
        selectCourt();
        return
    }
    if (!reservationSelected()) {
        selectReservation();
        return;
    }
    if (!dateSelected()) {
        selectDate();
        return;
    }

    if (!timeSelected() && appointmentTimesLoaded() && !selectTime()) continueOrStop();
    if (checkForError()) continueOrStop();
    if (!apptFinalized()) finalizeAppt();
}

function login() {
    if (loginButton() && sessionStorage.getItem('loginClicked') !== 'true') {
        setTimeout(() => {
            sessionStorage.setItem('loginClicked', true);
            loginForm().submit();
        }, 1000);
        return true;
    } else if (loginButton()) {
        sessionStorage.removeItem('loginClicked');
        return true;
    }

    if (!loginButton()) sessionStorage.removeItem('loginClicked');
    return false;
}

if (login()) return;

addCss();
createManualRunButton();
addDatePicker();
addTimePicker();
addCourtPicker();
addDurationSelect();

if (isUnderFiveMinAfterMidnight() || manualRun()) {
    reserveCourt();
} else if (isFiveMinBeforeMidnight()) {
    reset();
    location.reload();
} else {
    reset();
    setTimeout(() => {
        location.reload();
    }, 60000);
}
