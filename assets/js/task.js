(function () {
  "use strict";

  var columns = {
    backlog: null,
    in_progress: null,
    done: null,
  };

  var taskForm;
  var formError;
  var editDialog;
  var editForm;
  var editFormError;

  function getTasks() {
    return window.TTC.loadTasks();
  }

  function saveAndRender(tasks) {
    window.TTC.saveTasks(tasks);
    renderBoard();
  }

  function validateInput(data) {
    var title = data.title.trim();
    var startDateTime = window.TTC.parseDateTime(data.start_datetime);
    var endDateTime = window.TTC.parseDateTime(data.end_datetime);

    if (!title || title.length < 1 || title.length > 120) {
      return "Title is required and must be 1-120 characters.";
    }
    if (!startDateTime) {
      return "Start date and time are required.";
    }
    if (!endDateTime) {
      return "End date and time are required.";
    }
    if (endDateTime.getTime() < startDateTime.getTime()) {
      return "End date and time must be the same as or after start date and time.";
    }

    return "";
  }

  function taskRange(task) {
    return (
      window.TTC.formatDateTime(task.start_datetime) +
      " - " +
      window.TTC.formatDateTime(task.end_datetime)
    );
  }

  function buildTaskCard(task) {
    var card = document.createElement("article");
    card.className = "task-card";
    card.draggable = true;
    card.dataset.id = task.id;

    var title = document.createElement("h3");
    title.textContent = task.title;
    card.appendChild(title);

    var range = document.createElement("p");
    range.className = "task-range";
    range.textContent = taskRange(task);
    card.appendChild(range);

    if (task.description) {
      var details = document.createElement("details");
      var summary = document.createElement("summary");
      summary.textContent = "Details";
      var text = document.createElement("p");
      text.textContent = task.description;
      details.appendChild(summary);
      details.appendChild(text);
      card.appendChild(details);
    }

    var actionRow = document.createElement("div");
    actionRow.className = "card-actions";

    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "edit-btn";
    editBtn.dataset.id = task.id;
    editBtn.textContent = "Edit";

    var deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "delete-btn";
    deleteBtn.dataset.id = task.id;
    deleteBtn.textContent = "Delete";

    actionRow.appendChild(editBtn);
    actionRow.appendChild(deleteBtn);
    card.appendChild(actionRow);

    card.addEventListener("dragstart", function (event) {
      event.dataTransfer.setData("text/plain", task.id);
      event.dataTransfer.effectAllowed = "move";
    });

    return card;
  }

  function renderBoard() {
    var tasks = getTasks();
    Object.keys(columns).forEach(function (status) {
      columns[status].innerHTML = "";
    });

    tasks.forEach(function (task) {
      var target = columns[task.status] || columns.backlog;
      target.appendChild(buildTaskCard(task));
    });
  }

  function bindDragDrop() {
    Object.keys(columns).forEach(function (status) {
      var zone = columns[status];

      zone.addEventListener("dragover", function (event) {
        event.preventDefault();
        zone.classList.add("drag-over");
      });

      zone.addEventListener("dragleave", function () {
        zone.classList.remove("drag-over");
      });

      zone.addEventListener("drop", function (event) {
        event.preventDefault();
        zone.classList.remove("drag-over");

        var taskId = event.dataTransfer.getData("text/plain");
        if (!taskId) {
          return;
        }

        var tasks = getTasks();
        var task = tasks.find(function (item) {
          return item.id === taskId;
        });

        if (!task || task.status === status) {
          return;
        }

        task.status = status;
        saveAndRender(tasks);
      });
    });
  }

  function handleCreateSubmit(event) {
    event.preventDefault();

    var payload = {
      title: document.getElementById("title").value,
      description: document.getElementById("description").value.trim(),
      start_datetime: document.getElementById("startDateTime").value,
      end_datetime: document.getElementById("endDateTime").value,
      status: "backlog",
    };

    var error = validateInput(payload);
    formError.textContent = error;
    if (error) {
      return;
    }

    var tasks = getTasks();
    tasks.push({
      id: window.TTC.generateId(),
      title: payload.title.trim(),
      description: payload.description,
      start_datetime: payload.start_datetime,
      end_datetime: payload.end_datetime,
      status: "backlog",
    });

    saveAndRender(tasks);
    taskForm.reset();
    formError.textContent = "";
    document.getElementById("title").focus();
  }

  function openEditDialog(taskId) {
    var tasks = getTasks();
    var task = tasks.find(function (item) {
      return item.id === taskId;
    });
    if (!task) {
      return;
    }

    document.getElementById("editId").value = task.id;
    document.getElementById("editTitle").value = task.title;
    document.getElementById("editDescription").value = task.description || "";
    document.getElementById("editStartDateTime").value = task.start_datetime;
    document.getElementById("editEndDateTime").value = task.end_datetime;
    editFormError.textContent = "";
    editDialog.showModal();
  }

  function handleEditSubmit(event) {
    event.preventDefault();

    var id = document.getElementById("editId").value;
    var payload = {
      title: document.getElementById("editTitle").value,
      description: document.getElementById("editDescription").value.trim(),
      start_datetime: document.getElementById("editStartDateTime").value,
      end_datetime: document.getElementById("editEndDateTime").value,
    };

    var error = validateInput(payload);
    editFormError.textContent = error;
    if (error) {
      return;
    }

    var tasks = getTasks();
    var task = tasks.find(function (item) {
      return item.id === id;
    });
    if (!task) {
      editDialog.close();
      return;
    }

    task.title = payload.title.trim();
    task.description = payload.description;
    task.start_datetime = payload.start_datetime;
    task.end_datetime = payload.end_datetime;

    saveAndRender(tasks);
    editDialog.close();
  }

  function handleBoardClick(event) {
    var target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.classList.contains("delete-btn")) {
      var taskId = target.dataset.id;
      if (!taskId) {
        return;
      }

      var tasks = getTasks();
      var task = tasks.find(function (item) {
        return item.id === taskId;
      });
      if (!task) {
        return;
      }

      var confirmed = window.confirm('Delete task "' + task.title + '"?');
      if (!confirmed) {
        return;
      }

      var remaining = tasks.filter(function (item) {
        return item.id !== taskId;
      });
      saveAndRender(remaining);
      return;
    }

    if (target.classList.contains("edit-btn")) {
      var editId = target.dataset.id;
      if (editId) {
        openEditDialog(editId);
      }
    }
  }

  async function handleReset() {
    var confirmed = window.confirm(
      "Clear local tasks and re-seed from data/tasks.json?"
    );
    if (!confirmed) {
      return;
    }

    await window.TTC.resetToSeed();
    renderBoard();
  }

  async function init() {
    await window.TTC.seedFromJsonIfEmpty();

    columns.backlog = document.getElementById("backlogColumn");
    columns.in_progress = document.getElementById("inProgressColumn");
    columns.done = document.getElementById("doneColumn");

    taskForm = document.getElementById("taskForm");
    formError = document.getElementById("formError");
    editDialog = document.getElementById("editDialog");
    editForm = document.getElementById("editForm");
    editFormError = document.getElementById("editFormError");

    taskForm.addEventListener("submit", handleCreateSubmit);
    document.querySelector(".kanban-wrap").addEventListener("click", handleBoardClick);
    editForm.addEventListener("submit", handleEditSubmit);
    document.getElementById("cancelEditBtn").addEventListener("click", function () {
      editDialog.close();
    });
    document.getElementById("resetBtn").addEventListener("click", handleReset);

    bindDragDrop();
    renderBoard();

    window.addEventListener("ttc:tasks-changed", renderBoard);
    window.addEventListener("storage", function (event) {
      if (event.key === window.TTC.STORAGE_KEY) {
        renderBoard();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
