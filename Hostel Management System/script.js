// Load from LocalStorage
let students = JSON.parse(localStorage.getItem("students")) || [];
let rooms = JSON.parse(localStorage.getItem("rooms")) || [];
let fees = JSON.parse(localStorage.getItem("fees")) || [];

// =================== Dashboard ===================
function loadDashboard() {
  document.getElementById("totalStudents").innerText = "Total Students: " + students.length;
  document.getElementById("totalRooms").innerText = "Total Rooms: " + rooms.length;
  let pending = fees.reduce((sum, f) => sum + (f.status === "Pending" ? f.amount : 0), 0);
  document.getElementById("pendingFees").innerText = "Pending Fees: " + pending;
}

// =================== Rooms ===================
function addRoom() {
  let number = document.getElementById("rnumber").value;
  let capacity = document.getElementById("rcapacity").value;
  if (!number || !capacity) return alert("Enter all details!");

  rooms.push({ number, capacity });
  localStorage.setItem("rooms", JSON.stringify(rooms));
  renderRooms();
  document.getElementById("rnumber").value = "";
  document.getElementById("rcapacity").value = "";
}

function renderRooms() {
  let table = document.getElementById("roomTable");
  if (!table) return;
  table.innerHTML = "";
  rooms.forEach((r, i) => {
    table.innerHTML += `<tr>
      <td>${r.number}</td><td>${r.capacity}</td>
      <td><button onclick="deleteRoom(${i})">Delete</button></td>
    </tr>`;
  });
}

function deleteRoom(i) {
  rooms.splice(i, 1);
  localStorage.setItem("rooms", JSON.stringify(rooms));
  renderRooms();
}

function loadRoomsDropdown() {
  let dropdown = document.getElementById("sroom");
  if (!dropdown) return;
  dropdown.innerHTML = "<option value=''>Select Room</option>";
  rooms.forEach(r => {
    dropdown.innerHTML += `<option value="${r.number}">${r.number}</option>`;
  });
}

// =================== Students ===================
function addStudent() {
  let name = document.getElementById("sname").value;
  let roll = document.getElementById("sroll").value;
  let room = document.getElementById("sroom").value;
  if (!name || !roll || !room) return alert("Enter all details!");

  students.push({ name, roll, room });
  localStorage.setItem("students", JSON.stringify(students));
  renderStudents();
  document.getElementById("sname").value = "";
  document.getElementById("sroll").value = "";
  document.getElementById("sroom").value = "";
}

function renderStudents() {
  let table = document.getElementById("studentTable");
  if (!table) return;
  table.innerHTML = "";
  students.forEach((s, i) => {
    table.innerHTML += `<tr>
      <td>${s.name}</td><td>${s.roll}</td><td>${s.room}</td>
      <td><button onclick="deleteStudent(${i})">Delete</button></td>
    </tr>`;
  });
}

function deleteStudent(i) {
  students.splice(i, 1);
  localStorage.setItem("students", JSON.stringify(students));
  renderStudents();
}

// =================== Fees ===================
function addFee() {
  let roll = document.getElementById("froll").value;
  let amount = parseInt(document.getElementById("famount").value);
  if (!roll || !amount) return alert("Enter all details!");

  fees.push({ roll, amount, status: "Pending" });
  localStorage.setItem("fees", JSON.stringify(fees));
  renderFees();
  document.getElementById("froll").value = "";
  document.getElementById("famount").value = "";
}

function renderFees() {
  let table = document.getElementById("feeTable");
  if (!table) return;
  table.innerHTML = "";
  fees.forEach((f, i) => {
    table.innerHTML += `<tr>
      <td>${f.roll}</td><td>${f.amount}</td><td>${f.status}</td>
      <td>
        <button onclick="markPaid(${i})">Mark Paid</button>
        <button onclick="deleteFee(${i})">Delete</button>
      </td>
    </tr>`;
  });
}

function markPaid(i) {
  fees[i].status = "Paid";
  localStorage.setItem("fees", JSON.stringify(fees));
  renderFees();
}

function deleteFee(i) {
  fees.splice(i, 1);
  localStorage.setItem("fees", JSON.stringify(fees));
  renderFees();
}
