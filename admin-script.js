// Admin User Management Script

// Declare toggleModal function
function toggleModal(modalId) {
  const modal = document.getElementById(modalId)
  if (modal) {
    modal.style.display = modal.style.display === "block" ? "none" : "block"
  }
}

// Initialize admin page
document.addEventListener("DOMContentLoaded", () => {
  if (window.location.pathname.includes("admin-user-management.html")) {
    initializeAdminPage()
  }
})

// Mock users database (in real app, this would be from backend)
const usersDatabase = JSON.parse(localStorage.getItem("usersDatabase")) || {
  students: [],
  teachers: [],
  organizers: [],
  admins: [
    {
      id: 1,
      name: "Admin User",
      email: "admin@viit.ac.in",
      userId: "ADMIN001",
      role: "admin",
      createdAt: new Date().toISOString(),
    },
  ],
}

function initializeAdminPage() {
  // Check if user is admin
  const currentUser = JSON.parse(localStorage.getItem("currentUser"))
  if (!currentUser || currentUser.role !== "admin") {
    alert("Access denied. Admin privileges required.")
    window.location.href = "dashboard.html"
    return
  }

  // Render all user lists
  renderUsersList()

  // Initialize create user form
  const createUserForm = document.getElementById("createUserForm")
  if (createUserForm) {
    createUserForm.addEventListener("submit", handleCreateUser)
  }
}

function renderUsersList() {
  renderStudents()
  renderFaculty()
  renderOrganizers()
  renderAdmins()
}

function renderStudents() {
  const studentsList = document.getElementById("studentsList")
  if (!studentsList) return

  if (usersDatabase.students.length === 0) {
    studentsList.innerHTML = '<p style="color: var(--text-secondary); padding: 1rem;">No students yet.</p>'
    return
  }

  studentsList.innerHTML = usersDatabase.students
    .map(
      (user) => `
        <div class="user-item">
            <div class="user-info">
                <div class="user-name">${user.name}</div>
                <div class="user-email">${user.email} • ${user.userId}</div>
            </div>
            <div class="user-actions">
                <button class="btn btn-secondary btn-small" onclick="editUser(${user.id}, 'student')">Edit</button>
                <button class="btn btn-secondary btn-small" onclick="deleteUser(${user.id}, 'student')" style="color: var(--danger-color);">Delete</button>
            </div>
        </div>
    `,
    )
    .join("")
}

function renderFaculty() {
  const facultyList = document.getElementById("facultyList")
  if (!facultyList) return

  if (usersDatabase.teachers.length === 0) {
    facultyList.innerHTML = '<p style="color: var(--text-secondary); padding: 1rem;">No faculty members yet.</p>'
    return
  }

  facultyList.innerHTML = usersDatabase.teachers
    .map(
      (user) => `
        <div class="user-item">
            <div class="user-info">
                <div class="user-name">${user.name}</div>
                <div class="user-email">${user.email} • ${user.userId}</div>
            </div>
            <div class="user-actions">
                <button class="btn btn-secondary btn-small" onclick="editUser(${user.id}, 'teacher')">Edit</button>
                <button class="btn btn-secondary btn-small" onclick="deleteUser(${user.id}, 'teacher')" style="color: var(--danger-color);">Delete</button>
            </div>
        </div>
    `,
    )
    .join("")
}

function renderOrganizers() {
  const organizersList = document.getElementById("organizersList")
  if (!organizersList) return

  if (usersDatabase.organizers.length === 0) {
    organizersList.innerHTML = '<p style="color: var(--text-secondary); padding: 1rem;">No organizers yet.</p>'
    return
  }

  organizersList.innerHTML = usersDatabase.organizers
    .map(
      (user) => `
        <div class="user-item">
            <div class="user-info">
                <div class="user-name">${user.name}</div>
                <div class="user-email">${user.email} • ${user.userId}</div>
            </div>
            <div class="user-actions">
                <button class="btn btn-secondary btn-small" onclick="editUser(${user.id}, 'organizer')">Edit</button>
                <button class="btn btn-secondary btn-small" onclick="deleteUser(${user.id}, 'organizer')" style="color: var(--danger-color);">Delete</button>
            </div>
        </div>
    `,
    )
    .join("")
}

function renderAdmins() {
  const adminsList = document.getElementById("adminsList")
  if (!adminsList) return

  adminsList.innerHTML = usersDatabase.admins
    .map(
      (user) => `
        <div class="user-item">
            <div class="user-info">
                <div class="user-name">${user.name}</div>
                <div class="user-email">${user.email} • ${user.userId}</div>
            </div>
            <div class="user-actions">
                ${
                  user.id !== 1
                    ? `
                    <button class="btn btn-secondary btn-small" onclick="editUser(${user.id}, 'admin')">Edit</button>
                    <button class="btn btn-secondary btn-small" onclick="deleteUser(${user.id}, 'admin')" style="color: var(--danger-color);">Delete</button>
                `
                    : '<span style="color: var(--text-secondary); font-size: 0.75rem;">Primary Admin</span>'
                }
            </div>
        </div>
    `,
    )
    .join("")
}

function handleCreateUser(e) {
  e.preventDefault()

  const formData = {
    id: Date.now(),
    role: document.getElementById("userRole").value,
    name: document.getElementById("fullName").value,
    email: document.getElementById("userEmail").value,
    userId: document.getElementById("userId").value,
    password: document.getElementById("userPassword").value,
    createdAt: new Date().toISOString(),
  }

  // Validate email format
  if (!formData.email.endsWith("@viit.ac.in")) {
    alert("Email must end with @viit.ac.in")
    return
  }

  // Add user to appropriate list
  const roleMap = {
    student: "students",
    teacher: "teachers",
    organizer: "organizers",
    admin: "admins",
  }

  const userList = roleMap[formData.role]
  usersDatabase[userList].push(formData)

  // Save to localStorage
  localStorage.setItem("usersDatabase", JSON.stringify(usersDatabase))

  // Render updated lists
  renderUsersList()

  // Close modal and reset form
  toggleModal("createUserModal")
  e.target.reset()

  alert(
    `User created successfully!\n\nEmail: ${formData.email}\nTemporary Password: ${formData.password}\n\nPlease share these credentials with the user.`,
  )

  console.log("[v0] User created:", formData)
}

function deleteUser(userId, role) {
  if (!confirm("Are you sure you want to delete this user?")) {
    return
  }

  const roleMap = {
    student: "students",
    teacher: "teachers",
    organizer: "organizers",
    admin: "admins",
  }

  const userList = roleMap[role]
  usersDatabase[userList] = usersDatabase[userList].filter((user) => user.id !== userId)

  // Save to localStorage
  localStorage.setItem("usersDatabase", JSON.stringify(usersDatabase))

  // Render updated lists
  renderUsersList()

  console.log("[v0] User deleted:", userId, role)
}

function editUser(userId, role) {
  alert(
    "Edit functionality would be implemented here.\n\nIn a real application, this would open a modal to edit user details.",
  )
  console.log("[v0] Edit user:", userId, role)
}
