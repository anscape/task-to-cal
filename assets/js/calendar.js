(function () {
  "use strict";

  var HOUR_COUNT = 24;
  var HOUR_HEIGHT = 56;
  var MIN_EVENT_HEIGHT = 18;

  var weekStart;
  var weekHeaderEl;
  var weekEventsEl;
  var weekLabelEl;
  var detailsHintEl;

  var STATUS_TEXT = {
    backlog: "Backlog",
    in_progress: "In Progress",
    done: "Done",
  };

  function compareAsc(a, b) {
    return a.getTime() - b.getTime();
  }

  function maxDate(a, b) {
    return a.getTime() > b.getTime() ? a : b;
  }

  function minDate(a, b) {
    return a.getTime() < b.getTime() ? a : b;
  }

  function minutesBetween(start, end) {
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  }

  function buildWeekDays(monday) {
    var days = [];
    for (var i = 0; i < 7; i += 1) {
      days.push(window.TTC.addDays(monday, i));
    }
    return days;
  }

  function buildWeeklySegments(tasks, weekDays) {
    var dayBuckets = [[], [], [], [], [], [], []];
    var weekStartDate = window.TTC.startOfDay(weekDays[0]);
    var weekEndExclusive = window.TTC.addDays(weekStartDate, 7);

    tasks.forEach(function (task) {
      var taskStart = window.TTC.parseDateTime(task.start_datetime);
      var taskEnd = window.TTC.parseDateTime(task.end_datetime);
      if (!taskStart || !taskEnd) {
        return;
      }

      if (taskEnd.getTime() < weekStartDate.getTime() || taskStart.getTime() > weekEndExclusive.getTime()) {
        return;
      }

      for (var dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        var dayStart = window.TTC.startOfDay(weekDays[dayIndex]);
        var dayEnd = window.TTC.addDays(dayStart, 1);

        var segmentStart = maxDate(taskStart, dayStart);
        var segmentEnd = minDate(taskEnd, dayEnd);

        if (segmentEnd.getTime() <= segmentStart.getTime()) {
          continue;
        }

        dayBuckets[dayIndex].push({
          task: task,
          start: segmentStart,
          end: segmentEnd,
        });
      }
    });

    return dayBuckets;
  }

  function layoutOverlapColumns(segments) {
    var sorted = segments.slice().sort(function (a, b) {
      if (a.start.getTime() !== b.start.getTime()) {
        return compareAsc(a.start, b.start);
      }
      return compareAsc(a.end, b.end);
    });

    var groups = [];
    var currentGroup = null;

    sorted.forEach(function (segment) {
      if (!currentGroup) {
        currentGroup = {
          end: segment.end,
          events: [segment],
        };
        return;
      }

      if (segment.start.getTime() < currentGroup.end.getTime()) {
        currentGroup.events.push(segment);
        if (segment.end.getTime() > currentGroup.end.getTime()) {
          currentGroup.end = segment.end;
        }
      } else {
        groups.push(currentGroup);
        currentGroup = {
          end: segment.end,
          events: [segment],
        };
      }
    });

    if (currentGroup) {
      groups.push(currentGroup);
    }

    groups.forEach(function (group) {
      var colEnds = [];

      group.events
        .sort(function (a, b) {
          if (a.start.getTime() !== b.start.getTime()) {
            return compareAsc(a.start, b.start);
          }
          return compareAsc(a.end, b.end);
        })
        .forEach(function (segment) {
          var colIndex = -1;

          for (var i = 0; i < colEnds.length; i += 1) {
            if (segment.start.getTime() >= colEnds[i].getTime()) {
              colIndex = i;
              break;
            }
          }

          if (colIndex === -1) {
            colIndex = colEnds.length;
            colEnds.push(segment.end);
          } else {
            colEnds[colIndex] = segment.end;
          }

          segment.colIndex = colIndex;
        });

      var colCount = Math.max(1, colEnds.length);
      group.events.forEach(function (segment) {
        segment.colCount = colCount;
      });
    });

    return sorted;
  }

  function renderWeekHeader(weekDays) {
    weekHeaderEl.innerHTML = "";

    var corner = document.createElement("div");
    corner.className = "week-corner";
    weekHeaderEl.appendChild(corner);

    var todayYmd = window.TTC.toYMD(new Date());

    weekDays.forEach(function (date) {
      var head = document.createElement("div");
      head.className = "day-head";
      if (window.TTC.toYMD(date) === todayYmd) {
        head.classList.add("today");
      }

      var dayName = document.createElement("span");
      dayName.className = "name";
      dayName.textContent = date.toLocaleDateString("en-US", { weekday: "short" });

      var dayDate = document.createElement("span");
      dayDate.className = "date";
      dayDate.textContent = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      head.appendChild(dayName);
      head.appendChild(dayDate);
      weekHeaderEl.appendChild(head);
    });
  }

  function renderDetails(task) {
    detailsHintEl.innerHTML = "";

    var lines = [
      task.title,
      window.TTC.formatDateTime(task.start_datetime) + " - " + window.TTC.formatDateTime(task.end_datetime),
      "Status: " + STATUS_TEXT[task.status],
    ];

    if (task.description) {
      lines.push(task.description);
    }

    lines.forEach(function (line, index) {
      var p = document.createElement("p");
      if (index === 0) {
        var strong = document.createElement("strong");
        strong.textContent = line;
        p.appendChild(strong);
      } else {
        p.textContent = line;
      }
      detailsHintEl.appendChild(p);
    });
  }

  function createTimeColumn() {
    var col = document.createElement("div");
    col.className = "time-column";

    for (var hour = 0; hour < HOUR_COUNT; hour += 1) {
      var label = document.createElement("div");
      label.className = "time-label";

      var display = new Date();
      display.setHours(hour, 0, 0, 0);
      label.textContent = display.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });

      col.appendChild(label);
    }

    return col;
  }

  function createDayColumn(dayDate, daySegments) {
    var dayStart = window.TTC.startOfDay(dayDate);

    var dayColumn = document.createElement("div");
    dayColumn.className = "day-column";
    dayColumn.style.setProperty("--hour-count", String(HOUR_COUNT));
    dayColumn.style.setProperty("--hour-height", HOUR_HEIGHT + "px");

    var slots = document.createElement("div");
    slots.className = "hour-slots";
    for (var i = 0; i < HOUR_COUNT; i += 1) {
      var slot = document.createElement("div");
      slot.className = "hour-slot";
      slots.appendChild(slot);
    }

    var layer = document.createElement("div");
    layer.className = "events-layer";

    layoutOverlapColumns(daySegments).forEach(function (segment) {
      var event = document.createElement("button");
      event.type = "button";
      event.className = "event-block " + segment.task.status.replace("_", "-");

      var startMinutes = minutesBetween(dayStart, segment.start);
      var endMinutes = minutesBetween(dayStart, segment.end);
      var durationMinutes = Math.max(1, endMinutes - startMinutes);

      var top = (startMinutes / 60) * HOUR_HEIGHT;
      var height = Math.max(MIN_EVENT_HEIGHT, (durationMinutes / 60) * HOUR_HEIGHT);

      event.style.top = top + "px";
      event.style.height = height + "px";
      event.style.left = "calc(" + (100 * (segment.colIndex / segment.colCount)) + "% + 2px)";
      event.style.width = "calc(" + (100 / segment.colCount) + "% - 4px)";

      event.textContent = segment.task.title;
      event.title =
        segment.task.title +
        " | " +
        window.TTC.formatDateTime(segment.task.start_datetime) +
        " - " +
        window.TTC.formatDateTime(segment.task.end_datetime) +
        (segment.task.description ? " | " + segment.task.description : "") +
        " | " +
        STATUS_TEXT[segment.task.status];

      event.addEventListener("click", function () {
        renderDetails(segment.task);
      });

      layer.appendChild(event);
    });

    dayColumn.appendChild(slots);
    dayColumn.appendChild(layer);
    return dayColumn;
  }

  function renderWeekEvents(weekDays, tasks) {
    weekEventsEl.innerHTML = "";

    var dayBuckets = buildWeeklySegments(tasks, weekDays);

    weekEventsEl.appendChild(createTimeColumn());

    for (var dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      weekEventsEl.appendChild(createDayColumn(weekDays[dayIndex], dayBuckets[dayIndex]));
    }

    var hasAny = dayBuckets.some(function (segments) {
      return segments.length > 0;
    });

    if (!hasAny) {
      var empty = document.createElement("div");
      empty.className = "empty-week";
      empty.textContent = "No events in this week.";
      weekEventsEl.appendChild(empty);
    }
  }

  function renderWeekLabel(weekDays) {
    weekLabelEl.textContent =
      window.TTC.formatDate(weekDays[0]) + " - " + window.TTC.formatDate(weekDays[6]);
  }

  function render() {
    var weekDays = buildWeekDays(weekStart);
    var tasks = window.TTC.loadTasks();

    renderWeekHeader(weekDays);
    renderWeekEvents(weekDays, tasks);
    renderWeekLabel(weekDays);
  }

  async function handleReset() {
    var confirmed = window.confirm(
      "Clear local tasks and re-seed from data/tasks.json?"
    );
    if (!confirmed) {
      return;
    }

    await window.TTC.resetToSeed();
    detailsHintEl.textContent = "Click an event to view full details.";
    render();
  }

  async function init() {
    await window.TTC.seedFromJsonIfEmpty();

    weekStart = window.TTC.getMonday(new Date());
    weekHeaderEl = document.getElementById("weekHeader");
    weekEventsEl = document.getElementById("weekEvents");
    weekLabelEl = document.getElementById("weekLabel");
    detailsHintEl = document.getElementById("detailsHint");

    document.getElementById("prevWeekBtn").addEventListener("click", function () {
      weekStart = window.TTC.addDays(weekStart, -7);
      render();
    });

    document.getElementById("nextWeekBtn").addEventListener("click", function () {
      weekStart = window.TTC.addDays(weekStart, 7);
      render();
    });

    document.getElementById("todayBtn").addEventListener("click", function () {
      weekStart = window.TTC.getMonday(new Date());
      render();
    });

    document.getElementById("resetBtn").addEventListener("click", handleReset);

    window.addEventListener("ttc:tasks-changed", render);
    window.addEventListener("storage", function (event) {
      if (event.key === window.TTC.STORAGE_KEY) {
        render();
      }
    });

    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
