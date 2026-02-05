(function () {
  "use strict";

  var STORAGE_KEY = "ttc_tasks_v1";
  var STATUSES = ["backlog", "in_progress", "done"];

  function parseYMD(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }

    var parts = value.split("-");
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    var day = Number(parts[2]);
    var date = new Date(year, month - 1, day, 0, 0, 0, 0);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  function parseDateTime(value) {
    if (value instanceof Date) {
      return new Date(value.getTime());
    }

    if (typeof value !== "string") {
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return parseYMD(value);
    }

    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
      return null;
    }

    var split = value.split("T");
    var datePart = split[0];
    var timePart = split[1];

    var date = parseYMD(datePart);
    if (!date) {
      return null;
    }

    var hm = timePart.split(":");
    var hours = Number(hm[0]);
    var minutes = Number(hm[1]);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }

    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  function toYMD(date) {
    if (!(date instanceof Date)) {
      return "";
    }

    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function toDateTimeLocal(date) {
    if (!(date instanceof Date)) {
      return "";
    }

    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    var hours = String(date.getHours()).padStart(2, "0");
    var minutes = String(date.getMinutes()).padStart(2, "0");

    return year + "-" + month + "-" + day + "T" + hours + ":" + minutes;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  function addDays(date, n) {
    var next = new Date(date.getTime());
    next.setDate(next.getDate() + n);
    return next;
  }

  function getMonday(date) {
    var input = date instanceof Date ? new Date(date.getTime()) : parseDateTime(date);
    if (!input) {
      input = new Date();
    }

    var monday = startOfDay(input);
    var dayIndex = monday.getDay();
    var diff = (dayIndex + 6) % 7;
    monday.setDate(monday.getDate() - diff);
    return monday;
  }

  function formatDate(value) {
    var date = value instanceof Date ? value : parseDateTime(value);
    if (!date) {
      return "Invalid date";
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  function formatDateTime(value) {
    var date = value instanceof Date ? value : parseDateTime(value);
    if (!date) {
      return "Invalid date/time";
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  function isBetweenInclusive(dateValue, startValue, endValue) {
    var date = dateValue instanceof Date ? dateValue : parseDateTime(dateValue);
    var start = startValue instanceof Date ? startValue : parseDateTime(startValue);
    var end = endValue instanceof Date ? endValue : parseDateTime(endValue);

    if (!date || !start || !end) {
      return false;
    }

    var t = date.getTime();
    return t >= start.getTime() && t <= end.getTime();
  }

  function generateId() {
    return (
      "task_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 8)
    );
  }

  function coerceLegacyStart(task) {
    var direct = parseDateTime(task.start_datetime);
    if (direct) {
      return direct;
    }

    var legacy = parseYMD(task.start_date);
    if (!legacy) {
      return null;
    }

    legacy.setHours(9, 0, 0, 0);
    return legacy;
  }

  function coerceLegacyEnd(task, start) {
    var direct = parseDateTime(task.end_datetime);
    if (direct) {
      return direct;
    }

    var legacy = parseYMD(task.end_date);
    if (!legacy) {
      return null;
    }

    if (start && toYMD(start) === toYMD(legacy)) {
      legacy.setHours(10, 0, 0, 0);
      return legacy;
    }

    legacy.setHours(17, 0, 0, 0);
    return legacy;
  }

  function normalizeTask(task) {
    if (!task || typeof task !== "object") {
      return null;
    }

    var title = typeof task.title === "string" ? task.title.trim() : "";
    var description =
      typeof task.description === "string" ? task.description.trim() : "";
    var status = STATUSES.indexOf(task.status) >= 0 ? task.status : "backlog";

    var startDateTime = coerceLegacyStart(task);
    var endDateTime = coerceLegacyEnd(task, startDateTime);

    if (!title || !startDateTime || !endDateTime) {
      return null;
    }

    if (endDateTime.getTime() < startDateTime.getTime()) {
      return null;
    }

    return {
      id: typeof task.id === "string" && task.id ? task.id : generateId(),
      title: title.slice(0, 120),
      description: description,
      start_datetime: toDateTimeLocal(startDateTime),
      end_datetime: toDateTimeLocal(endDateTime),
      start_date: toYMD(startDateTime),
      end_date: toYMD(endDateTime),
      status: status,
    };
  }

  function loadTasks() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    try {
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map(normalizeTask)
        .filter(function (task) {
          return task !== null;
        });
    } catch (error) {
      console.warn("Could not parse saved tasks:", error);
      return [];
    }
  }

  function saveTasks(tasks) {
    var safeTasks = Array.isArray(tasks)
      ? tasks
          .map(normalizeTask)
          .filter(function (task) {
            return task !== null;
          })
      : [];

    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeTasks));
    window.dispatchEvent(new CustomEvent("ttc:tasks-changed"));
    return safeTasks;
  }

  async function seedFromJsonIfEmpty() {
    if (localStorage.getItem(STORAGE_KEY) !== null) {
      return loadTasks();
    }

    try {
      var response = await fetch("data/tasks.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Seed request failed: " + response.status);
      }

      var data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error("Seed file did not return an array");
      }

      return saveTasks(data);
    } catch (error) {
      console.warn("Seed data unavailable. Starting with empty tasks.", error);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    }
  }

  async function resetToSeed() {
    localStorage.removeItem(STORAGE_KEY);
    return seedFromJsonIfEmpty();
  }

  window.TTC = {
    STORAGE_KEY: STORAGE_KEY,
    loadTasks: loadTasks,
    saveTasks: saveTasks,
    seedFromJsonIfEmpty: seedFromJsonIfEmpty,
    resetToSeed: resetToSeed,
    generateId: generateId,
    parseYMD: parseYMD,
    parseDateTime: parseDateTime,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    getMonday: getMonday,
    addDays: addDays,
    startOfDay: startOfDay,
    isBetweenInclusive: isBetweenInclusive,
    toYMD: toYMD,
    toDateTimeLocal: toDateTimeLocal,
  };
})();
