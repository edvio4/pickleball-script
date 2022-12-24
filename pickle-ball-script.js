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
const dateTimeNow = () => DateTime.now().setZone('America/Chicago');
const selectedDate = () => DateTime.fromISO(window.localStorage.getItem('selectedDate'));
const dayBeforeSelectedDate = () => selectedDate().minus({ days: 1 });
const diffMinutes = () => dayBeforeSelectedDate().diff(dateTimeNow(), 'minutes').toObject().minutes;
const isUnderFiveMinAfterMidnight = () => diffMinutes() > -5 && diffMinutes() <= 0;
const isFiveMinBeforeMidnight = () => diffMinutes() <= 3 && diffMinutes() > 0;
const selectedDateSimple = () => selectedDate().toLocaleString(DateTime.DATE_HUGE);

// Local Storage
const courtSelected = () => window.localStorage.getItem('courtSelected') === 'true';
const reservationSelected = () => window.localStorage.getItem('reservationSelected') === 'true';
const dateSelected = () => window.localStorage.getItem('dateSelected') === 'true';
const timeSelected = () => window.localStorage.getItem('timeSelected') === 'true';
const apptFinalized = () => window.localStorage.getItem('apptFinalized') === 'true';
const stop = () => window.localStorage.getItem('stop') === 'true';
const manualRun = () => window.localStorage.getItem('manualRun') === 'true';
const selectedTimes = () => window.localStorage.getItem('times') ? window.localStorage.getItem('times').split(',') : [];
const selectedTimesFiltered = () => selectedTimes().filter(n => n);
const selectedCourts = () => window.localStorage.getItem('courts') ? window.localStorage.getItem('courts').split(',') : [];
const selectedCourtsFiltered = () => selectedCourts().filter(n => n);
const selectedDuration = () => window.localStorage.getItem('selectedDuration') ?? 0;
const lastTimeNotChecked = () => window.localStorage.getItem(`time_checked_${selectedTimesFiltered().length}`) !== 'true';
const lastTimeChecked = () => window.localStorage.getItem(`time_checked_${selectedTimesFiltered().length}`) === 'true';

// Elements
const finalizeButton = () => document.querySelector('input[value="Finalize  Appointment "]');
const nextButton = () => document.querySelector('input[value="Next"]');
const previousButton = () => document.querySelector('input[value="Previous"]');
const timesTable = () => document.getElementsByClassName("appointment-list-style")[0];
const loginButton = () => document.querySelector('input[value="Log In"]');
const loginForm = () => document.querySelector('form[name="auth_form"]');
const usernameInput = () => document.querySelector('input[name="loginname"]');
const timeElements = () => Array.from(timesTable().querySelectorAll('tr')).filter(el => el.querySelector('form'));

const sleep = ms => new Promise(r => setTimeout(r, ms));

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
    sessionStorage.removeItem('loginClicked');
    resetTimes();
    resetCourts();
}

function resetForNextCourt() {
    window.localStorage.setItem('timeSelected', false);
    window.localStorage.setItem('dateSelected', false);
    resetTimes();
}

function addDatePicker() {
    let logoutElement = document.getElementById('cv-navtab-item-logOut-id');
    let datepickerElement = '<span style="margin: 20px 10px 10px 10px">Pick Date</span><input type="text" id="date_picker_input" style="margin: 20px 0px 10px 0px">';
    let div = document.createElement('div');
    div.setAttribute("id", "date_picker");
    div.innerHTML = datepickerElement.trim();
    logoutElement.parentNode.insertBefore(div, logoutElement.nextSibling);

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
    let select = document.querySelector('select[name="e_id"]');
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

function createManualRunButton() {
    let durationSelectElement = document.getElementById('duration_select');
    let newButton = '<button type="button" id="run_script_button" style="margin: 10px 5px 20px 5px">Run Script</button><span>Clicking this manually runs the script.</span><div style="margin-bottom: 20px">The script will run automatically at midnight the day before your chosen date. You don\'t need to click the "Run Script" button for this to happen.</div>'
    let div = document.createElement('div');
    div.setAttribute("id", "run_script");
    div.innerHTML = newButton.trim();
    durationSelectElement.parentNode.insertBefore(div, durationSelectElement.nextSibling);
    document.getElementById ("run_script_button").addEventListener (
        "click", manuallyRunScript, false
    );
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

    if (manualRun()) {
        alert('Date chosen is not yet available.');
        stopRunning();
        return;
    }

    reset();
    location.reload();
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
    if (!timesTable().rows.length && index < selectedTimesFiltered().length && previousButton()) {
        window.localStorage.setItem(`time_checked_${index}`, true);
        previousButton().click();
        return true;
    }

    let element = timeElements().find(el => {
        const tds = el.querySelectorAll('td');
        return tds[0].innerText === selectedDateSimple() && tds[1].innerText === time;
    });

    if (element) {
        window.localStorage.setItem('timeSelected', true);
        window.localStorage.setItem(`time_checked_${index}`, true);
        element.querySelector('form').submit();
        return true;
    }

    return false;
}

function nextOrPrevious() {
    let [time, index] = timeBeingChecked();

    let timeConverted = DateTime.fromFormat(time, 'h:mma');
    let times = timeElements();
    let timeLast = times[times.length-1];

    let first = { date: times[0].querySelectorAll('td')[0].innerText, time: DateTime.fromFormat(times[0].querySelectorAll('td')[1].innerText, 'h:mma') };
    let last = { date: timeLast.querySelectorAll('td')[0].innerText, time: DateTime.fromFormat(timeLast.querySelectorAll('td')[1].innerText, 'h:mma') };

    const checkSameDay = () => {
        if (selectedDateSimple() !== first.date || selectedDateSimple() !== last.date) return 2;

        if (timeConverted < first.time && previousButton()) {
            previousButton().click();
            return 1;
        }

        if (timeConverted > last.time && nextButton()) {
            nextButton().click();
            return 1;
        }

        return 2;
    };

    const checkDifferentDay = () => {
        if (selectedDateSimple() !== first.date && previousButton()) {
            previousButton().click();
            return 3;
        }

        if (selectedDateSimple() === first.date && timeConverted < first.time && previousButton()) {
            previousButton().click();
            return 1;
        }

        return 2;
    }

    const sameDayState = checkSameDay();
    if (sameDayState !== 2 ) return sameDayState;

    return checkDifferentDay();
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
    const nextOrPreviousState = nextOrPrevious();
    if (nextOrPreviousState === 1) return;
    if (timeBeingChecked().length) {
        window.localStorage.setItem(`time_checked_${timeBeingChecked()[1]}`, true);
        if (nextOrPreviousState === 2) reserveCourt();
    }
    if (timeBeingChecked().length || courtBeingChecked().length) return;

    stopRunning();
}

function checkForError() {
    const errorElement1 = Array.from(document.querySelectorAll('font'))
        .find(el => el.textContent === 'Reservation requires more time than the selected time slot allows, please select another time.');
    const errorElement2 = document.querySelector('font[color="red"]')
    if (!errorElement1 && !errorElement2) return false;

    if (errorElement1) {
        window.localStorage.setItem('timeSelected', false);
        if (lastTimeChecked()) return true;
        errorElement1.remove();
        reserveCourt();
        return false;
    }

    if (errorElement2) stopRunning();
    return false;
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
        window.localStorage.setItem('dateSelected', false);
        selectCourt();
        return;
    }
    if (!reservationSelected()) {
        selectReservation();
        return;
    }
    if (!dateSelected()) {
        selectDate();
        return;
    }

    if (!timeSelected() && !selectTime()) continueOrStop();
    if (checkForError()) continueOrStop();
    if (!apptFinalized()) finalizeAppt();
}

async function login() {
    if (loginButton() && sessionStorage.getItem('loginClicked') !== 'true') {
        for (let i of [...Array(4)]) {
            await sleep(500);
            if (usernameInput().value) {
                sessionStorage.setItem('loginClicked', true);
                loginForm().submit();
                return true;
            }
        }
        return false;
    }

    if (!loginButton()) sessionStorage.removeItem('loginClicked');
    return true;
}

// Start of running the script
if (!(await login())) return;

addCss();
addDatePicker();
addTimePicker();
addCourtPicker();
addDurationSelect();
createManualRunButton();

if (isUnderFiveMinAfterMidnight() || manualRun()) {
    reserveCourt();
    return;
}
if (isFiveMinBeforeMidnight()) {
    reset();
    location.reload();
    return;
}

reset();
setTimeout(() => {
    location.reload();
}, 60000);
