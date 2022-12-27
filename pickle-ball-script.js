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

const sleep = ms => new Promise(r => setTimeout(r, ms));

const Element = (function() {
    const finalizeButton = () => document.querySelector('input[value="Finalize  Appointment "]');
    const nextButton = () => document.querySelector('input[value="Next"]');
    const previousButton = () => document.querySelector('input[value="Previous"]');
    const timesTable = () => document.getElementsByClassName("appointment-list-style")[0];
    const loginButton = () => document.querySelector('input[value="Log In"]');
    const loginForm = () => document.querySelector('form[name="auth_form"]');
    const usernameInput = () => document.querySelector('input[name="loginname"]');
    const timeElements = () => Array.from(timesTable().querySelectorAll('tr')).filter(el => el.querySelector('form'));

    return { finalizeButton, nextButton, previousButton, timesTable, loginButton, loginForm, usernameInput, timeElements };
})();

const Storage = (function() {
    const getItem = key => window.localStorage.getItem(key);
    const setItem = (key, val) => window.localStorage.setItem(key, val);

    const manualRun = () => getItem('manualRun') === 'true';
    const selectedTimes = () => getItem('times') ? getItem('times').split(',') : [];
    const selectedCourts = () => getItem('courts') ? getItem('courts').split(',') : [];
    const selectedDuration = () => getItem('selectedDuration') ?? 0;
    const selectedCourtsFiltered = () => selectedCourts().filter(n => n);
    const courtSelected = () => getItem('courtSelected') === 'true';
    const reservationSelected = () => getItem('reservationSelected') === 'true';
    const dateSelected = () => getItem('dateSelected') === 'true';
    const timeSelected = () => getItem('timeSelected') === 'true';
    const apptFinalized = () => getItem('apptFinalized') === 'true';
    const stop = () => getItem('stop') === 'true';
    const selectedTimesFiltered = () => selectedTimes().filter(n => n);

    // const lastTimeNotChecked = () => getItem(`time_checked_${selectedTimesFiltered().length}`) !== 'true';
    const lastTimeChecked = () => getItem(`time_checked_${selectedTimesFiltered().length}`) === 'true';
    const timeChecked = index => getItem(`time_checked_${index}`) === 'true';
    const courtChecked = index => getItem(`court_checked_${index}`) === 'true';

    const setTimes = val => setItem('times', val);

    function resetTimes() {
        [...Array(3)].forEach((item, i) => {
            let index = i+1;
            setItem(`time_checked_${index}`, false);
        });
    }

    function stopRunning() {
        setItem('stop', true);
        setItem('manualRun', false);
    }

    function resetCourts() {
        selectedCourtsFiltered().forEach((item, i) => {
            let index = i+1;
            setItem(`court_checked_${index}`, false);
        });
    }

    function reset() {
        setItem('courtSelected', false);
        setItem('reservationSelected', false);
        setItem('dateSelected', false);
        setItem('timeSelected', false);
        setItem('apptFinalized', false);
        setItem('stop', false);
        setItem('manualRun', false);
        sessionStorage.removeItem('loginClicked');
        resetTimes();
        resetCourts();
    }

    function resetForNextCourt() {
        setItem('timeSelected', false);
        setItem('dateSelected', false);
        resetTimes();
    }

    return { getItem, setItem, stopRunning, reset, resetForNextCourt, manualRun, selectedTimes, selectedCourts, selectedDuration, selectedCourtsFiltered,
        courtSelected, reservationSelected, dateSelected, timeSelected, apptFinalized, stop, selectedTimesFiltered, lastTimeChecked, timeChecked, courtChecked };
})();

const Time = (function() {
    // Private
    const dateTimeNow = () => DateTime.now().setZone('America/Chicago');
    const dayBeforeSelectedDate = () => selectedDate().minus({ days: 1 });
    const diffMinutes = () => dayBeforeSelectedDate().diff(dateTimeNow(), 'minutes').toObject().minutes;

    // Public
    const selectedDate = () => DateTime.fromISO(Storage.getItem('selectedDate'));
    const selectedDateSimple = () => selectedDate().toLocaleString(DateTime.DATE_HUGE);
    const isUnderFiveMinAfterMidnight = () => diffMinutes() > -5 && diffMinutes() <= 0;
    const isFiveMinBeforeMidnight = () => diffMinutes() <= 3 && diffMinutes() > 0;

    return { selectedDate, selectedDateSimple, isUnderFiveMinAfterMidnight, isFiveMinBeforeMidnight };
})();

const AddElement = (function() {
    function addDatePicker() {
        let logoutElement = document.getElementById('cv-navtab-item-logOut-id');
        let datepickerElement = '<span style="margin: 20px 10px 10px 10px">Pick Date</span><input type="text" id="date_picker_input" style="margin: 20px 0px 10px 0px">';
        let div = document.createElement('div');
        div.setAttribute("id", "date_picker");
        div.innerHTML = datepickerElement.trim();
        logoutElement.parentNode.insertBefore(div, logoutElement.nextSibling);

        datepicker('#date_picker_input', {
            onSelect: (instance, date) => {
                Storage.setItem('selectedDate', DateTime.fromJSDate(date).toISO());
            },
            dateSelected: Time.selectedDate().toJSDate(),
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
            $(`#time_picker_input_${index}`).timepicker('setTime', Storage.selectedTimes()[i]);
            $(`#time_picker_input_${index}`).on('changeTime', function() {
                let time = $(this).val()
                let existingTimes = Storage.selectedTimes();
                existingTimes[i] = time;
                Storage.setItem('times', existingTimes.join(','));
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
            document.getElementById(`court_picker_input_${index}`).checked = Storage.selectedCourts()[i];
            $(`#court_picker_input_${index}`).change(function() {
                let existingCourts = Storage.selectedCourts();
                existingCourts[i] = this.checked ? courts[index-1] : '';
                document.getElementById(`court_picker_input_${index}`).checked = this.checked;
                Storage.setItem('courts', existingCourts.join(','));
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
        select.value = Storage.selectedDuration();
        $(`#duration_picker`).change(function() {
            Storage.setItem('selectedDuration', this.value);
        });
    }

    function manuallyRunScript() {
        Storage.reset();
        let court = Array.from(document.querySelectorAll('option'))
            .find(el => el.textContent === 'Select Court');
        court.selected = true;
        Storage.setItem('manualRun', true);
        court.parentElement.onchange();
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

    return { addDatePicker,addTimePicker, addCourtPicker, addDurationSelect, createManualRunButton, addCss };
})();

const Script = (function() {
    function selectCourt() {
        let [courtName, index] = courtBeingChecked();
        let court = Array.from(document.querySelectorAll('option'))
            .find(el => el.textContent === courtName);
        court.selected = true;
        Storage.setItem('courtSelected', true);
        court.parentElement.onchange();
    }

    function selectReservation() {
        let duration = Storage.selectedDuration();
        if (!duration || duration === '0') return;

        let name = parseInt(duration) === 1 ? '1 Hour Singles' : '1 1/2 Hour Doubles';
        let reservation = Array.from(document.querySelectorAll('option'))
            .find(el => el.textContent === name);
        reservation.selected = true;
        Storage.setItem('reservationSelected', true);
        reservation.parentElement.onchange();
    }

    function selectDate() {
        let date = Array.from(document.querySelectorAll('[id="cv-leftnav-item-calendar-available-id"]'))
            .find(el => el.textContent == Time.selectedDate().day);
        if (date) {
            Storage.setItem('dateSelected', true);
            date.click();
            return;
        }

        if (Storage.manualRun()) {
            alert('Date chosen is not yet available.');
            Storage.stopRunning();
            return;
        }

        Storage.reset();
        location.reload();
    }

    function timeBeingChecked() {
        for (let [i, time] of Storage.selectedTimesFiltered().entries()) {
            let index = i+1;
            if (Storage.timeChecked(index)) continue;
            return [time, index];
        }
        return [];
    }

    function courtBeingChecked() {
        for (let [i, court] of Storage.selectedCourtsFiltered().entries()) {
            let index = i+1;
            if (Storage.courtChecked(index)) continue;
            return [court, index];
        }
        return [];
    }

    function selectTime() {
        let [time, index] = timeBeingChecked();

        if (!time) return false;
        if (!Element.timesTable().rows.length) {
            Storage.setItem(`time_checked_${index}`, true);
            if (index < Storage.selectedTimesFiltered().length && Element.previousButton()) {
                Element.previousButton().click();
                return true;
            }
            return false;
        }

        let element = Element.timeElements().find(el => {
            const tds = el.querySelectorAll('td');
            return tds[0].innerText === Time.selectedDateSimple() && tds[1].innerText === time;
        });

        if (element) {
            Storage.setItem('timeSelected', true);
            Storage.setItem(`time_checked_${index}`, true);
            element.querySelector('form').submit();
            return true;
        }

        return false;
    }

    function nextOrPrevious() {
        let [time, index] = timeBeingChecked();

        let timeConverted = DateTime.fromFormat(time, 'h:mma');
        let times = Element.timeElements();
        let timeLast = times[times.length-1];

        let first = { date: times[0].querySelectorAll('td')[0].innerText, time: DateTime.fromFormat(times[0].querySelectorAll('td')[1].innerText, 'h:mma') };
        let last = { date: timeLast.querySelectorAll('td')[0].innerText, time: DateTime.fromFormat(timeLast.querySelectorAll('td')[1].innerText, 'h:mma') };

        const checkSameDay = () => {
            if (Time.selectedDateSimple() !== first.date || Time.selectedDateSimple() !== last.date) return 3;

            if (timeConverted < first.time && Element.previousButton()) {
                Element.previousButton().click();
                return 1;
            }

            if (timeConverted > last.time && Element.nextButton()) {
                Element.nextButton().click();
                return 1;
            }

            return 2;
        };

        const checkDifferentDay = () => {
            if (Time.selectedDateSimple() !== first.date && Element.previousButton()) {
                Element.previousButton().click();
                return 3;
            }

            if (Time.selectedDateSimple() === first.date && timeConverted < first.time && Element.previousButton()) {
                Element.previousButton().click();
                return 1;
            }

            return 2;
        }

        const sameDayState = checkSameDay();
        if (sameDayState !== 3 ) return sameDayState;

        return checkDifferentDay();
    }

    function finalizeAppt() {
        if (Element.finalizeButton()) {
            Storage.setItem('apptFinalized', true);
            Storage.stopRunning();
            Element.finalizeButton().click();
        }
    }

    function continueOrStop() {
        let [court, index] = courtBeingChecked();

        if (Storage.lastTimeChecked() && court && court !== Storage.selectedCourtsFiltered().pop()) {
            Storage.setItem(`court_checked_${index}`, true);
            Storage.setItem('courtSelected', false);
            Storage.resetForNextCourt();
            reserveCourt();
            return;
        }
        if (Storage.lastTimeChecked() && court === Storage.selectedCourtsFiltered().pop()) {
            Storage.stopRunning();
            return;
        };
        const nextOrPreviousState = nextOrPrevious();
        if (nextOrPreviousState === 1) return;
        if (timeBeingChecked().length) {
            Storage.setItem(`time_checked_${timeBeingChecked()[1]}`, true);
            if (nextOrPreviousState === 2) reserveCourt();
        }
        if (timeBeingChecked().length || courtBeingChecked().length) return;

        Storage.stopRunning();
    }

    function checkForError() {
        const errorElement1 = Array.from(document.querySelectorAll('font'))
            .find(el => el.textContent === 'Reservation requires more time than the selected time slot allows, please select another time.');
        const errorElement2 = document.querySelector('font[color="red"]')
        if (!errorElement1 && !errorElement2) return false;

        if (errorElement1) {
            Storage.setItem('timeSelected', false);
            if (Storage.lastTimeChecked()) return true;
            errorElement1.remove();
            reserveCourt();
            return false;
        }

        if (errorElement2.textContent === 'No more appointments match your selectionsPlease begin a new search') {
            return false;
        }
        if (errorElement2) Storage.stopRunning();
        return false;
    }

    function checkForMissingFormData() {
        let duration = Storage.selectedDuration();

        if (!Storage.selectedTimesFiltered().length) {
            alert('No times specified.');
            Storage.stopRunning();
            return true;
        }
        if (!duration || duration === '0') {
            alert('Please select duration.');
            Storage.stopRunning();
            return true;
        };
        if (!Time.selectedDate()) {
            alert('No date specified.');
            Storage.stopRunning();
            return true;
        }
        if (!Storage.selectedCourtsFiltered().length) {
            alert('No courts selected.');
            Storage.stopRunning();
            return true;
        }
        if (!Storage.selectedTimesFiltered().length) {
            alert('No times specified.');
            Storage.stopRunning();
            return true;
        }

        return false;
    }

    function reserveCourt() {
        if (checkForMissingFormData()) return;
        if (Storage.stop()) return;

        if (!Storage.courtSelected() && courtBeingChecked().length) {
            Storage.setItem('dateSelected', false);
            selectCourt();
            return;
        }
        if (!Storage.reservationSelected()) {
            selectReservation();
            return;
        }
        if (!Storage.dateSelected()) {
            selectDate();
            return;
        }

        if (!Storage.timeSelected() && !selectTime()) continueOrStop();
        if (checkForError()) continueOrStop();
        if (!Storage.apptFinalized()) finalizeAppt();
    }

    async function login() {
        if (Element.loginButton() && sessionStorage.getItem('loginClicked') !== 'true') {
            for (let i of [...Array(4)]) {
                await sleep(500);
                if (Element.usernameInput().value) {
                    sessionStorage.setItem('loginClicked', true);
                    Element.loginForm().submit();
                    return true;
                }
            }
            return false;
        }

        if (!Element.loginButton()) sessionStorage.removeItem('loginClicked');
        return true;
    }

    return { reserveCourt, login };
})();

// Start of running the script
if (!(await Script.login())) return;

AddElement.addCss();
AddElement.addDatePicker();
AddElement.addTimePicker();
AddElement.addCourtPicker();
AddElement.addDurationSelect();
AddElement.createManualRunButton();

if (Time.isUnderFiveMinAfterMidnight() || Storage.manualRun()) {
    Script.reserveCourt();
    return;
}
if (Time.isFiveMinBeforeMidnight()) {
    Storage.reset();
    location.reload();
    return;
}

Storage.reset();
setTimeout(() => {
    location.reload();
}, 60000);
