// Admin User Management Script

// Declare API_BASE_URL variable
const API_BASE_URL = "https://campusconnect-backend-gclf.onrender.com/api/v1"

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

async function loadModerationData() {
  try {
    const [resourcesRes, eventsRes, communityRes, marketplaceRes, lostFoundRes] = await Promise.all([
      fetch(`${API_BASE_URL}/resources`)
        .then((r) => r.json())
        .catch(() => ({ resources: [] })),
      fetch(`${API_BASE_URL}/events`)
        .then((r) => r.json())
        .catch(() => ({ events: [] })),
      fetch(`${API_BASE_URL}/community`)
        .then((r) => r.json())
        .catch(() => ({ posts: [] })),
      fetch(`${API_BASE_URL}/marketplace`)
        .then((r) => r.json())
        .catch(() => ({ items: [] })),
      fetch(`${API_BASE_URL}/lostfound`)
        .then((r) => r.json())
        .catch(() => ({ posts: [] })),
    ])

    const resources = resourcesRes.resources || []
    const events = eventsRes.events || []
    const posts = communityRes.posts || []
    const marketplace = marketplaceRes.items || []
    const lostFound = lostFoundRes.posts || []

    return {
      resources,
      events,
      posts,
      marketplace,
      lostFound,
    }
  } catch (error) {
    console.error("Error loading moderation data:", error)
    return { resources: [], events: [], posts: [], marketplace: [], lostFound: [] }
  }
}

async function renderModeration() {
  const roleSelect = document.getElementById("moderationRole")
  const sectionSelect = document.getElementById("moderationSection")
  const container = document.getElementById("moderationContainer")

  if (!roleSelect || !sectionSelect || !container) return

  const selectedRole = roleSelect.value
  const selectedSection = sectionSelect.value

  const data = await loadModerationData()

  console.log("[v0] Selected Role:", selectedRole, "Selected Section:", selectedSection)

  let filteredContent = []

  if (selectedRole === "student") {
    if (selectedSection === "resources") {
      filteredContent = data.resources || []
    } else if (selectedSection === "marketplace") {
      filteredContent = data.marketplace.filter((item) => item.uploaderRole === "student")
    } else if (selectedSection === "lostfound") {
      filteredContent = data.lostFound.filter((item) => item.posterRole === "student")
    } else if (selectedSection === "community") {
      filteredContent = data.posts.filter((post) => post.posterRole === "student" && post.type !== "announcement")
    }
  } else if (selectedRole === "faculty") {
    if (selectedSection === "resources") {
      filteredContent = data.resources || []
    } else if (selectedSection === "community") {
      filteredContent = data.posts.filter((post) => post.posterRole === "faculty" && post.type !== "announcement")
    }
  } else if (selectedRole === "organizer") {
    if (selectedSection === "announcements") {
      filteredContent = data.posts.filter((post) => post.posterRole === "organizer" && post.type === "announcement")
    } else if (selectedSection === "events") {
      filteredContent = data.events.filter((event) => event.organizerRole === "organizer")
    }
  }

  console.log("[v0] Filtered content count:", filteredContent.length)
  console.log("[v0] Filtered content:", filteredContent)

  if (filteredContent.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No ${selectedSection} found.</p>`
    return
  }

  container.innerHTML = filteredContent
    .map((item) => {
      const itemId = item._id || item.id
      const title = item.title || item.content || item.name || "Untitled"
      const author =
        item.posterName ||
        item.uploaderName ||
        item.organizerName ||
        item.createdBy?.fullName ||
        item.uploadedBy?.fullName ||
        item.postedBy?.fullName ||
        "Unknown"
      return `
        <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 0.5rem;">
          <h4 style="margin: 0 0 0.5rem 0;">${title}</h4>
          <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">By ${author}</p>
          <button onclick="deleteModeratedContent('${itemId}', '${selectedSection}')" style="background: var(--danger-color); color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; margin-top: 0.5rem;">Delete</button>
        </div>
      `
    })
    .join("")
}

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
