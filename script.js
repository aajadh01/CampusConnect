// Reminder: Always read this file before editing to avoid overwriting important logic.

// API Configuration
//const API_BASE_URL = 'https://campusconnect-backend-gclf.onrender.com/api/v1'
// const API_BASE_URL = "http://localhost:5000/api/v1"
const API_BASE_URL = "https://campusconnect-backend-gclf.onrender.com/api/v1"

// Global State Management
const appState = {
  currentUser: null,
  selectedRole: null,
  resources: [],
  marketplaceItems: [],
  events: [],
  lostFoundItems: [],
  discussions: [], // This will now hold non-announcement posts
  notifications: [], // This will now hold announcements
  points: 0,
  badges: [],
  users: [], // Initially empty, populated by backend
  organizerRequests: [],
  viewMyUploads: false, // extend global state: special filters
  viewMyPurchases: false, // extend global state: special filters
  lastAdded: null, // extend global state: lastAdded marker
  // extend app state
  chats: {}, // { [itemId]: [{by:'me'|'them', text, at}] }
  currentChatItemId: null,
  isSubmitting: false, // Track if a form is currently submitting
  userWishlist: [], // Added to hold user-specific wishlist data from backend
  posts: [], // Combined posts and announcements initially fetched
}

// ===== API UTILITIES =====
function getAuthToken() {
  return localStorage.getItem("authToken")
}

function getAuthHeaders() {
  const token = getAuthToken()
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  }
}

function getFormDataHeaders() {
  const token = getAuthToken()
  return {
    ...(token && { Authorization: `Bearer ${token}` }),
  }
}

async function apiCall(endpoint, options = {}) {
  try {
    const url = `${API_BASE_URL}${endpoint}`
    const headers = {
      ...getAuthHeaders(),
      ...options.headers,
    }

    console.log("Making API call to:", url)
    console.log("Request options:", { ...options, headers })

    const response = await fetch(url, {
      ...options,
      headers,
    })

    console.log("Response status:", response.status)
    console.log("Response headers:", response.headers)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: "Network error" }))
      console.log("Error response:", errorData)
      throw new Error(errorData.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    console.log("Response data:", data)
    return data
  } catch (error) {
    console.error("API call failed:", error)
    console.error("Error type:", error.constructor.name)
    console.error("Error message:", error.message)
    throw error
  }
}

async function apiCallFormData(endpoint, formData) {
  try {
    const url = `${API_BASE_URL}${endpoint}`
    console.log("[v0] FormData API call to:", url)

    const response = await fetch(url, {
      method: "POST",
      headers: getFormDataHeaders(),
      body: formData,
    })

    console.log("[v0] Response status:", response.status)

    if (!response.ok) {
      let errorData
      try {
        errorData = await response.json()
      } catch (e) {
        errorData = { message: `HTTP ${response.status}` }
      }
      console.error("[v0] API error response:", errorData)
      throw new Error(errorData.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    console.log("[v0] FormData response:", data)
    return data
  } catch (error) {
    console.error("[v0] FormData API call failed:", error)
    throw error
  }
}

function normalizeRoleForApi(role) {
  // Map UI role "teacher" to backend role "faculty"
  return String(role || "").toLowerCase() === "teacher" ? "faculty" : role
}
function svgIcon(name, size = 16) {
  return `<svg class="icon-inline" width="${size}" height="${size}" aria-hidden="true" focusable="false"><use href="public/icons.jpg#${name}"></use></svg>`
}
function withIcon(name, text, size = 16) {
  // keep for other places that still use SVGs (e.g., buttons)
  const emojiMap = {
    book: "📚",
    tag: "🏷️",
    user: "👤",
    calendar: "📅",
    "map-pin": "📍",
    pin: "📍",
    phone: "📞",
    "id-badge": "🪪",
    branch: "🏫",
    semester: "📘",
    "arrow-up": "👍", // thumbs up for upvote
    download: "📥", // inbox for download
  }
  const e = emojiMap[name] || "•"
  return `<span class="emoji-inline" aria-hidden="true">${e}</span>${text}`
}

function normalizeData(data) {
  if (!data) return data

  if (Array.isArray(data)) {
    return data.map((item) => normalizeData(item))
  }

  if (typeof data === "object") {
    const normalized = {}
    for (const key in data) {
      if (key === "_id") {
        normalized.id = data[key]
      } else if (key === "uploadedAt" || key === "createdAt" || key === "postedAt" || key === "at") {
        normalized[key] = data[key]
      } else if (key === "imageUrl" || key === "poster") {
        normalized.image = data[key]
      } else if (typeof data[key] === "object" && data[key] !== null) {
        // Handle nested objects like uploadedBy
        if (data[key]._id) {
          normalized[key] = {
            ...data[key],
            id: data[key]._id,
          }
        } else {
          normalized[key] = normalizeData(data[key])
        }
      } else {
        normalized[key] = data[key]
      }
    }
    return normalized
  }

  return data
}

function getUserWishlist() {
  // Return from appState which is populated from backend
  return (appState.userWishlist || []).map((item) => String(item._id || item.id))
}

function setUserWishlist(arr) {
  // This is now handled by backend, but keep for compatibility
  const key = "wishlist_" + getUserId()
  localStorage.setItem(key, JSON.stringify(arr || []))
}

function isWishlisted(resourceId) {
  return getUserWishlist().includes(String(resourceId))
}

async function toggleWishlist(resourceId) {
  try {
    const idStr = String(resourceId).trim()
    if (!idStr || idStr === "undefined") {
      throw new Error("Invalid resource ID")
    }

    const resource = appState.resources.find((r) => String(r._id || r.id) === idStr)
    if (!resource) {
      throw new Error("Resource not found")
    }

    const actualResourceId = resource._id || resource.id
    const isInWishlist = isWishlisted(String(actualResourceId))

    if (isInWishlist) {
      await apiCall("/wishlist/remove", {
        method: "POST",
        body: JSON.stringify({ resourceId: String(actualResourceId) }),
      })
    } else {
      await apiCall("/wishlist/add", {
        method: "POST",
        body: JSON.stringify({ resourceId: String(actualResourceId) }),
      })
    }

    await loadWishlistFromBackend()

    // Re-render resources and wishlist to reflect state
    renderResources()
    renderWishlist()
    showNotification(isInWishlist ? "Removed from wishlist" : "Added to wishlist")
  } catch (error) {
    console.error("[v0] Wishlist operation failed:", error)
    alert(`Wishlist operation failed: ${error.message}`)
  }
}

async function loadWishlistFromBackend() {
  try {
    const response = await apiCall("/wishlist/get", { method: "GET" })
    appState.userWishlist = response || []
    console.log("[v0] Loaded user wishlist:", appState.userWishlist.length, "items")
  } catch (error) {
    console.error("[v0] Failed to load wishlist from backend:", error)
    appState.userWishlist = []
  }
}

// ===== PERMISSION CHECKS =====
function isAdmin() {
  return (appState?.currentUser?.role || "").toLowerCase() === "admin"
}

// Initialize app on page load
document.addEventListener("DOMContentLoaded", () => {
  initializePage()

  const createEventForm = document.getElementById("createEventForm")
  if (createEventForm) {
    createEventForm.addEventListener("submit", (e) => {
      e.preventDefault()
      handleCreateEvent()
    })
  }

  const announcementForm = document.getElementById("announcementForm")
  if (announcementForm) {
    announcementForm.addEventListener("submit", (e) => {
      e.preventDefault()
      postAnnouncement()
    })
  }

  const form = document.getElementById("adminCreateUserForm")
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault()
      const fullName = document.getElementById("auName").value
      const role = document.getElementById("auRole").value
      const registeredId = document.getElementById("auReg").value
      const password = (document.getElementById("auPass")?.value || "").trim()

      if (!fullName || !role || !registeredId || !password) {
        alert("Please fill in all fields")
        return
      }

      try {
        await apiCall("/admin/users", {
          method: "POST",
          body: JSON.stringify({
            fullName,
            role: normalizeRoleForApi(role),
            registeredId,
            password,
          }),
        })

        // Reload users from backend
        await loadDataFromBackend()
        form.reset()
        toggleModal("createUserModal")
        showNotification("User created successfully!")
      } catch (error) {
        console.error("User creation failed:", error)
        alert(`User creation failed: ${error.message}`)
      }
    })
  }

  // Seed a sample organizer request on first load (if none)
  if ((appState.organizerRequests || []).length === 0) {
    appState.organizerRequests.push({ id: Date.now(), name: "Tech Club", by: "11831", email: "club@viit.ac.in" })
    saveStateToStorage()
  }

  // Profile dropdown toggles (common)
  const toggles = [
    { btn: "profileToggle", menu: "profileDropdown" },
    { btn: "profileToggleFaculty", menu: "profileDropdownFaculty" },
    { btn: "profileToggleOrganizer", menu: "profileDropdownOrganizer" },
    { btn: "profileToggleAdmin", menu: "profileDropdownAdmin" }, // added
  ]
  toggles.forEach(({ btn, menu }) => {
    const b = document.getElementById(btn)
    const m = document.getElementById(menu)
    if (b && m) {
      b.addEventListener("click", () => {
        const isActive = m.classList.contains("active")
        document.querySelectorAll(".profile-dropdown").forEach((el) => el.classList.remove("active"))
        m.classList.toggle("active", !isActive)
        b.setAttribute("aria-expanded", String(!isActive))
      })
      document.addEventListener("click", (e) => {
        if (m && !m.contains(e.target) && !b.contains(e.target)) m.classList.remove("active")
      })
    }
  })

  // Student: resource filter apply
  const applyRes = document.getElementById("applyResourceFilters")
  if (applyRes) applyRes.addEventListener("click", () => renderResources())

  const titleSearch = document.getElementById("filterTitle")
  if (titleSearch) titleSearch.addEventListener("input", () => renderResources())
  const wishlistSearch = document.getElementById("wishlistSearch")
  if (wishlistSearch) wishlistSearch.addEventListener("input", () => renderWishlist())

  // Student: lost & found tabs + search
  const lfTabs = ["lfTabAll", "lfTabLost", "lfTabFound"].map((id) => document.getElementById(id)).filter(Boolean)
  lfTabs.forEach((btn) =>
    btn.addEventListener("click", () => {
      lfTabs.forEach((b) => b.classList.remove("active"))
      btn.classList.add("active")
      renderLostFound()
    }),
  )
  const lfSearch = document.getElementById("lfSearch")
  if (lfSearch) lfSearch.addEventListener("input", () => renderLostFound())

  // Admin: apply user filters
  const adminApply = document.getElementById("adminApplyUserFilters")
  if (adminApply) adminApply.addEventListener("click", () => renderAdminUsers())

  const modApply = document.getElementById("modApplyFilters")
  if (modApply) modApply.addEventListener("click", () => renderModeration())

  const modRoleFilter = document.getElementById("modRoleFilter")
  if (modRoleFilter) {
    modRoleFilter.addEventListener("change", () => {
      updateModerationSections()
      renderModeration()
    })
  }

  const modSectionFilter = document.getElementById("modSectionFilter")
  if (modSectionFilter) {
    modSectionFilter.addEventListener("change", () => renderModeration())
  }

  // Organizer: poster live preview
  const evPoster = document.getElementById("evPoster")
  if (evPoster) {
    evPoster.addEventListener("change", () => {
      const file = evPoster.files?.[0]
      const preview = document.getElementById("posterPreview")
      if (!preview) return
      if (!file) {
        preview.innerHTML = "No poster selected"
        return
      }
      const url = URL.createObjectURL(file)
      preview.innerHTML = `<img src="${url}" alt="Poster preview" style="max-width:100%;border-radius:.5rem"/>`
      preview.setAttribute("aria-hidden", "false")
    })
  }

  // extend app state
  // appState.chats = appState.chats || {} // { [itemId]: [{by:'me'|'them', text, at}] }
  // appState.currentChatItemId = appState.currentChatItemId || null

  // render a chat thread for an item
  function renderChat(itemId) {
    const body = document.getElementById("chatBody")
    if (!body) return
    const thread = appState.chats[itemId] || []
    if (thread.length === 0) {
      // seed a simple starter thread
      appState.chats[itemId] = [
        { by: "them", text: "Hi! Is this available?", at: new Date().toISOString() },
        { by: "me", text: "Yes, it is.", at: new Date().toISOString() },
      ]
    }
    const msgs = (appState.chats[itemId] || [])
      .map((m) => `<div class="chat-message ${m.by === "me" ? "right" : "left"}">${m.text}</div>`)
      .join("")
    body.innerHTML = msgs
    body.scrollTop = body.scrollHeight
  }

  function openChat(itemId) {
    appState.currentChatItemId = itemId
    toggleModal("chatModal")
    renderChat(itemId)
  }
  window.openChat = openChat

  // Student: chat modal send
  const chatSend = document.getElementById("chatSend")
  if (chatSend) {
    chatSend.addEventListener("click", () => {
      const input = document.getElementById("chatInput")
      if (!input?.value) return
      const itemId = appState.currentChatItemId
      if (!itemId) return
      const thread = appState.chats[itemId] || []
      thread.push({ by: "me", text: input.value, at: new Date().toISOString() })
      appState.chats[itemId] = thread
      saveStateToStorage()
      input.value = ""
      renderChat(itemId)
    })
  }

  document.body.removeAttribute("data-theme")
  localStorage.removeItem("theme")
  const themeToggle = document.getElementById("toggleTheme")
  if (themeToggle) {
    const blk = themeToggle.closest(".switch") || themeToggle.closest(".form-group")
    if (blk) blk.remove()
  }

  const changePwdButtons = document.querySelectorAll('.dropdown-item[data-action="change-password"]')
  changePwdButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      navigateToSection("settings")
      // close any open profile dropdowns
      document.querySelectorAll(".profile-dropdown").forEach((el) => el.classList.remove("active"))
    })
  })

  // Password change handlers for all dashboards
  const passwordChangeButtons = document.querySelectorAll('button[onclick*="changePassword"]')
  passwordChangeButtons.forEach((btn) => {
    btn.addEventListener("click", handlePasswordChange)
  })

  // Also handle direct button clicks in settings sections
  document.addEventListener("click", (e) => {
    if (e.target.textContent === "Update" && e.target.closest("#settings")) {
      handlePasswordChange(e)
    }
  })

  const discussionsFilter = document.getElementById("discussionsFilter")
  if (discussionsFilter) {
    discussionsFilter.addEventListener("change", () => renderDiscussions())
  }

  const verifySearch = document.getElementById("verifySearch")
  if (verifySearch) {
    verifySearch.addEventListener("input", renderPendingVerification)
  }
  const verifySemester = document.getElementById("verifySemester")
  if (verifySemester) {
    verifySemester.addEventListener("change", renderPendingVerification)
  }
  const verifyBranch = document.getElementById("verifyBranch")
  if (verifyBranch) {
    verifyBranch.addEventListener("change", renderPendingVerification)
  }
  const applyVerifyFilters = document.getElementById("applyVerifyFilters")
  if (applyVerifyFilters) {
    applyVerifyFilters.addEventListener("click", renderPendingVerification)
  }

  enhanceDrawerAndProfile()
  roleSpecificCleanup()
})

// Initialize based on current page
function initializePage() {
  const currentPage = window.location.pathname.split("/").pop()

  // This was causing deleted items to reappear and new items to not show

  if (currentPage === "login.html") {
    initializeLogin()
  } else if (currentPage.includes("dashboard.html") && currentPage !== "dashboard.html") {
    initializeDashboard()
  }
}

// ===== ROLE SELECTION =====
function selectRole(role) {
  appState.selectedRole = role
  localStorage.setItem("selectedRole", role)
  window.location.href = "login.html"
}

// ===== LOGIN & REGISTRATION =====
function initializeLogin() {
  const loginForm = document.getElementById("loginForm")
  const roleTitle = document.getElementById("roleTitle")
  const regNumberInput = document.getElementById("regNumber")
  const regNumberHint = document.getElementById("regNumberHint")

  const selectedRole = localStorage.getItem("selectedRole") || "student"
  appState.selectedRole = selectedRole

  const roleInfo = {
    student: {
      title: "Student Login",
      placeholder: "Enter Your Id",
      // hint: "Students: 23L31A0501 | Staff: 11831",
    },
    teacher: {
      title: "Faculty Login",
      placeholder: "Enter Your Id",
      // hint: "Students: 23L31A0501 | Staff: 11831",
    },
    organizer: {
      title: "Organizer Login",
      placeholder: "Enter Your Id",
      // hint: "Students: 23L31A0501 | Staff: 11831",
    },
    admin: {
      title: "Admin Login",
      placeholder: "Enter Your Id",
      // hint: "Students: 23L31A0501 | Staff: 11831",
    },
  }

  roleTitle.textContent = roleInfo[selectedRole].title
  regNumberInput.placeholder = roleInfo[selectedRole].placeholder
  regNumberHint.textContent = roleInfo[selectedRole].hint

  // Handle form submission
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault()

    const formData = {
      regNumber: document.getElementById("regNumber").value,
      password: document.getElementById("password").value,
      role: selectedRole,
    }

    // Also persist the API role mapping for backend integration
    const apiRole = normalizeRoleForApi(selectedRole)
    localStorage.setItem("userRoleApi", apiRole)

    if (!validateRegNumber(formData.regNumber, selectedRole)) {
      alert(`Please enter a valid registration number`)
      return
    }

    // Simulate authentication (in real app, this would be an API call)
    handleLogin(formData)
  })
}

function validateRegNumber(regNumber, role) {
  // Student format: 2 digits + 1 letter + 2 digits + 1 letter + 4 digits (e.g., 23L31A0501)
  const studentPattern = /^[0-9]{2}[A-Z]{1}[0-9]{2}[A-Z]{1}[0-9]{4}$/i

  // Staff format (faculty, admin, organizer): 5 digits (e.g., 11831)
  const staffPattern = /^[0-9]{5}$/

  if (role === "student") {
    return studentPattern.test(regNumber)
  } else {
    // For faculty, admin, and organizer roles
    return staffPattern.test(regNumber)
  }
}

// function validateEmail(email, role) { ... }

async function handleLogin(formData) {
  try {
    console.log("Attempting login with:", { registeredId: formData.regNumber, role: formData.role })

    // Call backend login API
    const response = await apiCall("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        registeredId: formData.regNumber,
        password: formData.password,
      }),
    })

    console.log("Login response:", response)

    if (response.success && response.token) {
      // Store auth token and user data
      localStorage.setItem("authToken", response.token)
      localStorage.setItem("currentUser", JSON.stringify(response.user))
      localStorage.setItem("userRole", formData.role)

      appState.currentUser = response.user

      // Redirect to appropriate dashboard
      redirectToDashboard(formData.role)
    } else {
      throw new Error("Login failed")
    }
  } catch (error) {
    console.error("Login error details:", error)
    console.error("Error stack:", error.stack)
    alert(`Login failed: ${error.message}`)
  }
}

function redirectToDashboard(role) {
  window.location.href = `${role}-dashboard.html`
}

// ===== DASHBOARD INITIALIZATION =====
async function initializeDashboard() {
  // Check if user is logged in
  const currentUser = localStorage.getItem("currentUser")
  const authToken = localStorage.getItem("authToken")

  if (!currentUser || !authToken) {
    window.location.href = "dashboard.html"
    return
  }

  appState.currentUser = JSON.parse(currentUser)

  // Load data from backend
  await loadDataFromBackend()

  // Update user display
  const userName = document.getElementById("userName")
  const userNameDisplay = document.getElementById("userNameDisplay")
  const userAvatar = document.querySelector(".user-avatar")

  if (userName) userName.textContent = appState.currentUser.name
  if (userNameDisplay) userNameDisplay.textContent = appState.currentUser.name
  if (userAvatar && appState?.currentUser?.name)
    userAvatar.textContent = appState.currentUser.name.charAt(0).toUpperCase()

  // Initialize navigation
  initializeNavigation()

  // Initialize forms
  initializeForms()

  // Update stats
  updateStats()

  // Faculty
  renderPendingVerification()
  // Organizer
  renderOrganizerEvents()
  renderAnnouncements()
  // Admin
  renderAdminUsers()
  renderOrganizerRequests()
  renderModeration()
  updateAdminStats()

  // Ensure Dashboard opens the Overview on load
  if (document.getElementById("overview")) {
    navigateToSection("overview")
  }
}

// ===== BACKEND DATA LOADING =====
// Users are now loaded from localStorage via admin-script.js for admin dashboard
async function loadDataFromBackend() {
  console.log("[v0] Loading data from backend...")
  try {
    const [resourcesRes, marketplaceRes, eventsRes, lostFoundRes, wishlistRes, usersRes] = await Promise.all([
      apiCall("/resources", { method: "GET" }),
      apiCall("/marketplace", { method: "GET" }),
      apiCall("/events", { method: "GET" }),
      apiCall("/lostfound", { method: "GET" }),
      apiCall("/wishlist/get", { method: "GET" }),
      apiCall("/admin/users", { method: "GET" }).catch((err) => {
        console.warn("[v0] Could not fetch admin users:", err)
        return { users: [] }
      }),
    ])

    appState.resources = normalizeData(resourcesRes.resources || [])
    appState.marketplaceItems = normalizeData(marketplaceRes.items || [])
    appState.events = normalizeData(eventsRes.events || [])
    appState.lostFoundItems = normalizeData(lostFoundRes.posts || [])
    appState.userWishlist = normalizeData(wishlistRes || [])
    appState.users = normalizeData(usersRes.users || [])

    console.log("[v0] Loaded resources:", appState.resources.length)
    console.log("[v0] Loaded marketplace items:", appState.marketplaceItems.length)
    console.log("[v0] Loaded events:", appState.events.length)
    console.log("[v0] Loaded lost & found items:", appState.lostFoundItems.length)
    console.log("[v0] Loaded user wishlist:", appState.userWishlist.length)
    console.log("[v0] Loaded users:", appState.users.length)

    // Fetch community posts (includes both posts and announcements)
    const communityRes = await apiCall("/community")
    appState.posts = normalizeData(communityRes.posts || [])

    const announcements = (appState.posts || []).filter((p) => p.type === "announcement")
    appState.notifications = announcements
    appState.discussions = (appState.posts || []).filter((p) => p.type !== "announcement")

    console.log("[v0] Loaded posts:", appState.posts.length)
    console.log("[v0] Loaded announcements:", appState.notifications.length)
    console.log("[v0] Loaded discussions:", appState.discussions.length)
    console.log("[v0] Data loading complete")

    loadAndRenderData()
    updateStudentStats();
    updateFacultyStats();
    updateOrganizerStats();
    updateAdminStats();
  } catch (error) {
    console.error("[v0] Error loading data:", error)
    showNotification("Error loading data from server", "error")
  }
}

// ✅ Update all dashboard stats after data is fully loaded
updateStudentStats();
updateFacultyStats();
updateOrganizerStats();
updateAdminStats();

console.log("[v0] Dashboard stats updated successfully");


// ===== NAVIGATION =====
function initializeNavigation() {
  const navItems = document.querySelectorAll(".nav-item")
  const sections = document.querySelectorAll(".content-section")
  const menuToggle = document.getElementById("menuToggle")
  const sidebar = document.getElementById("sidebar")
  const sidebarClose = document.getElementById("sidebarClose")

  document.body.classList.add("drawer-mode")

  let backdrop = document.getElementById("drawerBackdrop")
  if (!backdrop) {
    backdrop = document.createElement("div")
    backdrop.id = "drawerBackdrop"
    backdrop.className = "drawer-backdrop"
    document.body.appendChild(backdrop)
  }

  // Remove legacy label injection; keep accessible name
  if (menuToggle) {
    menuToggle.setAttribute("aria-label", "Open menu")
  }

  // Navigation click handlers
  navItems.forEach((item) => {
    item.addEventListener("click", function (e) {
      e.preventDefault()
      const targetSection = this.getAttribute("data-section")
      appState.viewMyUploads = false
      appState.viewMyPurchases = false
      navigateToSection(targetSection)
      // re-render to ensure banners disappear
      loadAndRenderData()
    })
  })

  // Drawer open
  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      sidebar?.classList.add("active")
      backdrop.classList.add("active")
    })
  }

  // Drawer close
  if (sidebarClose) {
    sidebarClose.addEventListener("click", () => {
      sidebar.classList.remove("active")
      backdrop.classList.remove("active")
    })
  }
  backdrop.addEventListener("click", () => {
    sidebar?.classList.remove("active")
    backdrop.classList.remove("active")
  })

  document.getElementById("linkMyUploads")?.addEventListener("click", (e) => {
    e.preventDefault()
    appState.viewMyUploads = false
    navigateToSection("my-uploads")
    renderMyUploads()
  })
  document.getElementById("linkMyPurchases")?.addEventListener("click", (e) => {
    e.preventDefault()
    appState.viewMyPurchases = false
    navigateToSection("my-purchases")
    renderMyPurchases()
  })
  document.getElementById("linkWishlist")?.addEventListener("click", (e) => {
    e.preventDefault()
    navigateToSection("wishlist")
    renderWishlist()
  })
}

function navigateToSection(sectionId) {
  const page = window.location.pathname.split("/").pop() || ""
  const sid = sectionId

  const navItems = document.querySelectorAll(".nav-item")
  const sections = document.querySelectorAll(".content-section")
  navItems.forEach((item) => item.classList.remove("active"))
  sections.forEach((section) => section.classList.remove("active"))

  const selectedNav = document.querySelector(`[data-section="${sid}"]`)
  const selectedSection = document.getElementById(sid)
  if (selectedNav) selectedNav.classList.add("active")
  if (selectedSection) selectedSection.classList.add("active")

  const sidebar = document.getElementById("sidebar")
  const backdrop = document.getElementById("drawerBackdrop")
  if (sidebar) sidebar.classList.remove("active")
  if (backdrop) backdrop.classList.remove("active")
}

// ===== FORMS INITIALIZATION =====
function initializeForms() {
  // Upload Resource Form
  const uploadResourceForm = document.getElementById("uploadResourceForm")
  if (uploadResourceForm) {
    uploadResourceForm.addEventListener("submit", handleUploadResource)
  }

  // Post Item Form
  const postItemForm = document.getElementById("postItemForm")
  if (postItemForm) {
    postItemForm.addEventListener("submit", handlePostItem)
  }

  // Post Lost/Found Form
  const postLostFoundForm = document.getElementById("postLostFoundForm")
  if (postLostFoundForm) {
    postLostFoundForm.addEventListener("submit", handlePostLostFound)
  }

  // Post Discussion Form
  const postDiscussionForm = document.getElementById("postDiscussionForm")
  if (postDiscussionForm) {
    postDiscussionForm.addEventListener("submit", handlePostDiscussion)
  }

  enhanceNumericField("itemContact")
  enhanceNumericField("lfContact")
  // you can add more IDs here if new contact fields are added later
}

// ===== FORM HANDLERS =====
async function handleUploadResource(e) {
  e.preventDefault()

  if (appState.isSubmitting) {
    console.log("[v0] Upload already in progress, ignoring duplicate submission")
    return
  }

  const fileInput = document.getElementById("resourceFile")
  const file = fileInput?.files?.[0]

  if (!file) {
    alert("Please select a file to upload")
    return
  }

  try {
    appState.isSubmitting = true
    const submitBtn = e.target.querySelector('button[type="submit"]')
    if (submitBtn) {
      submitBtn.disabled = true
      submitBtn.textContent = "Uploading..."
    }

    const formData = new FormData()
    formData.append("file", file)
    formData.append("title", document.getElementById("resourceTitle").value)
    formData.append("subject", document.getElementById("resourceSubject").value)
    formData.append("description", document.getElementById("resourceDescription").value)
    formData.append("branch", document.getElementById("resourceBranch")?.value || "")
    formData.append("semester", document.getElementById("resourceSemester")?.value || "")

    console.log("[v0] Uploading resource...")
    const response = await apiCallFormData("/resources/upload", formData)

    console.log("[v0] Upload response:", response)

    if (response.resource || response.success) {
      // Reload resources from backend
      await loadDataFromBackend()
      updateStats()
      showNotification("Resource uploaded successfully")

      const form = document.getElementById("uploadResourceForm")
      if (form) form.reset()
      toggleModal("uploadResourceModal")
    } else {
      throw new Error("Upload response invalid")
    }
  } catch (error) {
    console.error("[v0] Upload failed:", error)
    showNotification(`Upload failed: ${error.message}`)
  } finally {
    appState.isSubmitting = false
    const submitBtn = e.target.querySelector('button[type="submit"]')
    if (submitBtn) {
      submitBtn.disabled = false
      submitBtn.textContent = "Upload"
    }
  }
}

async function handlePostItem(e) {
  e.preventDefault()

  if (appState.isSubmitting) {
    console.log("[v0] Post already in progress, ignoring duplicate submission")
    return
  }

  const title = document.getElementById("itemTitle").value
  const price = document.getElementById("itemPrice").value
  const description = document.getElementById("itemDescription").value
  const contact = document.getElementById("itemContact").value.trim()
  const imageFile = document.getElementById("itemImage")?.files?.[0]

  if (!title || !price || !contact) {
    alert("Title, price, and contact are required")
    return
  }

  if (!isDigitsOnly(contact)) {
    alert("Please enter digits only in Contact Info.")
    document.getElementById("itemContact").focus()
    return
  }

  if (!imageFile) {
    alert("Item image is required")
    return
  }

  try {
    appState.isSubmitting = true
    const submitBtn = e.target.querySelector('button[type="submit"]')
    if (submitBtn) {
      submitBtn.disabled = true
      submitBtn.textContent = "Posting..."
    }

    const formData = new FormData()
    formData.append("image", imageFile)
    formData.append("title", title)
    formData.append("price", price)
    formData.append("description", description)
    formData.append("contact", contact)

    console.log("[v0] Posting marketplace item...")
    const response = await apiCallFormData("/marketplace/upload", formData)

    console.log("[v0] Post response:", response)

    if (response.item || response.success) {
      // Reload marketplace items from backend
      await loadDataFromBackend()
      showNotification("Item posted successfully")

      const form = document.getElementById("postItemForm")
      if (form) form.reset()
      toggleModal("postItemModal")
    } else {
      throw new Error("Post response invalid")
    }
  } catch (error) {
    console.error("[v0] Post failed:", error)
    showNotification(`Post failed: ${error.message}`)
  } finally {
    appState.isSubmitting = false
    const submitBtn = e.target.querySelector('button[type="submit"]')
    if (submitBtn) {
      submitBtn.disabled = false
      submitBtn.textContent = "Post Item"
    }
  }
}

async function handlePostLostFound(e) {
  e.preventDefault()

  if (appState.isSubmitting) {
    console.log("[v0] Lost/Found post already in progress, ignoring duplicate submission")
    return
  }

  const type = document.getElementById("lfType").value
  const itemName = document.getElementById("lfItemName").value
  const description = document.getElementById("lfDescription").value
  const location = document.getElementById("lfLocation").value
  const contact = document.getElementById("lfContact").value.trim()
  const imageFile = document.getElementById("lfImage")?.files?.[0]

  if (!type || !itemName || !contact) {
    alert("Type, item name, and contact are required")
    return
  }

  if (!isDigitsOnly(contact)) {
    alert("Please enter digits only in Contact Info.")
    document.getElementById("lfContact").focus()
    return
  }

  if (!imageFile) {
    alert("Item image is required")
    return
  }

  try {
    appState.isSubmitting = true
    const submitBtn = e.target.querySelector('button[type="submit"]')
    if (submitBtn) {
      submitBtn.disabled = true
      submitBtn.textContent = "Submitting..."
    }

    const formData = new FormData()
    formData.append("image", imageFile)
    formData.append("type", type)
    formData.append("itemName", itemName)
    formData.append("description", description)
    formData.append("location", location)
    formData.append("contact", contact)

    console.log("[v0] Posting lost/found item...")
    const response = await apiCallFormData("/lostfound/create", formData)

    console.log("[v0] Lost/Found response:", response)

    if (response.post || response.success) {
      // Reload lost & found items from backend
      await loadDataFromBackend()
      showNotification("Lost/Found item posted successfully")

      const form = document.getElementById("postLostFoundForm")
      if (form) form.reset()
      toggleModal("postLostFoundModal")
    } else {
      throw new Error("Post response invalid")
    }
  } catch (error) {
    console.error("[v0] Lost/Found posting failed:", error)
    showNotification(`Lost/Found posting failed: ${error.message}`)
  } finally {
    appState.isSubmitting = false
    const submitBtn = e.target.querySelector('button[type="submit"]')
    if (submitBtn) {
      submitBtn.disabled = false
      submitBtn.textContent = "Submit"
    }
  }
}

async function handlePostDiscussion(e) {
  e.preventDefault()

  if (appState.isSubmitting) {
    console.log("[v0] Discussion post already in progress, ignoring duplicate submission")
    return
  }

  const title = document.getElementById("discussionTitle").value
  const content = document.getElementById("discussionContent").value
  const category = document.getElementById("discussionCategory").value
  const imageFile = document.getElementById("discussionImage")?.files?.[0]

  if (!content) {
    alert("Post content is required")
    return
  }

  try {
    appState.isSubmitting = true
    const submitBtn = e.target.querySelector('button[type="submit"]')
    if (submitBtn) {
      submitBtn.disabled = true
      submitBtn.textContent = "Posting..."
    }

    const formData = new FormData()
    formData.append("title", title)
    formData.append("content", content)
    formData.append("category", category)
    if (imageFile) {
      formData.append("image", imageFile)
    }

    console.log("[v0] Posting discussion...")
    const response = await apiCallFormData("/community/create", formData)

    console.log("[v0] Discussion response:", response)

    if (response.post || response.success) {
      // Reload discussions from backend
      await loadDataFromBackend()
      showNotification("Discussion posted successfully")

      const form = document.getElementById("postDiscussionForm")
      if (form) form.reset()
      toggleModal("postDiscussionModal")
    } else {
      throw new Error("Post response invalid")
    }
  } catch (error) {
    console.error("[v0] Discussion posting failed:", error)
    showNotification(`Discussion posting failed: ${error.message}`)
  } finally {
    appState.isSubmitting = false
    const submitBtn = e.target.querySelector('button[type="submit"]')
    if (submitBtn) {
      submitBtn.disabled = false
      submitBtn.textContent = "Post Discussion"
    }
  }
}

async function handleCreateEvent() {
  const title = document.getElementById("evTitle").value
  const date = document.getElementById("evDate").value
  const venue = document.getElementById("evVenue").value
  const description = document.getElementById("evDesc").value
  const formLink = document.getElementById("evForm").value // Added formLink capture
  const posterFile = document.getElementById("evPoster")?.files?.[0]

  if (!title || !date) {
    alert("Title and date are required")
    return
  }

  if (!posterFile) {
    alert("Event image is required")
    return
  }

  try {
    const formData = new FormData()
    formData.append("image", posterFile)
    formData.append("title", title)
    formData.append("date", date)
    formData.append("venue", venue)
    formData.append("description", description)
    formData.append("formLink", formLink) // Added formLink to form data

    const response = await apiCallFormData("/events/create", formData)

    if (response.event) {
      // Reload events from backend
      await loadDataFromBackend()
      updateAdminStats()
      document.getElementById("createEventForm").reset()
      const preview = document.getElementById("posterPreview")
      if (preview) preview.innerHTML = ""
      showNotification("Event created")
    }
  } catch (error) {
    console.error("Event creation failed:", error)
    alert(`Event creation failed: ${error.message}`)
  }
}

// =====RENDERING FUNCTIONS =====
function renderResources() {
  const resourcesList = document.getElementById("resourcesList")
  if (!resourcesList) return

  let arr = appState.resources || []

  // Apply filters
  const branch = document.getElementById("filterBranch")?.value || ""
  const semester = document.getElementById("filterSemester")?.value || ""
  const title = document.getElementById("filterTitle")?.value || ""

  if (branch) arr = arr.filter((r) => r.branch === branch)
  if (semester) arr = arr.filter((r) => r.semester === semester)
  if (title) arr = arr.filter((r) => r.title.toLowerCase().includes(title.toLowerCase()))

  if (arr.length === 0) {
    resourcesList.innerHTML = '<div class="empty-state"><p>No resources found.</p></div>'
    return
  }

  const wishlist = getUserWishlist()
  const votes = getUserVotes()

  resourcesList.innerHTML = arr
    .map((resource) => {
      const resourceId = resource._id || resource.id
      const saved = wishlist.includes(String(resourceId))
      const voted = votes.resources?.[resourceId] === "up"
      const canDelete =
        (resource.uploadedBy?._id || resource.uploadedBy?.id || resource.uploadedBy) ===
          (appState.currentUser?.id || "") || isAdmin()

      const uploaderName =
        typeof resource.uploadedBy === "object"
          ? resource.uploadedBy?.fullName || resource.uploadedBy?.name || resource.uploaderName || "-"
          : resource.uploaderName || resource.uploadedBy || "-"

      return `
        <div class="resource-item" data-resource-id="${resourceId}">
          <div class="resource-info">
            <h3>${resource.title}${resource.verified ? ' <span class="verified-badge">✓ Verified</span>' : ""}</h3>
            <p>${resource.description || "No description"}</p>
            <div class="resource-meta">
              <span>${withIcon("book", " " + (resource.subject || "-"))}</span>
              <span>${withIcon("tag", " " + (resource.branch || "-") + " • " + (resource.semester || "-"))}</span>
              <span>${withIcon("user", " " + uploaderName)}</span>
              <span>${withIcon("calendar", " " + formatDate(resource.uploadedAt))}</span>
            </div>
          </div>
          <div class="resource-actions">
            <button class="btn btn-secondary btn-small ${saved ? "active" : ""}" aria-pressed="${saved}" title="${
              saved ? "Remove from Wishlist" : "Add to Wishlist"
            }" onclick="toggleWishlist('${resourceId}')">🔖 ${saved ? "Saved" : "Wishlist"}</button>
            <button class="btn btn-secondary btn-small ${voted ? "active" : ""}" aria-pressed="${voted}" onclick="upvoteResource('${resourceId}')">${withIcon("arrow-up", " " + (resource.upvotes || 0))}</button>
            <button class="btn btn-primary btn-small" onclick="downloadResource('${resourceId}')">${withIcon("download", " " + (resource.downloads || 0))}</button>
            ${canDelete ? `<button class="btn btn-secondary btn-small" onclick="deleteResource('${resourceId}')">Delete</button>` : ""}
          </div>
        </div>`
    })
    .join("")
  if (appState.lastAdded?.type === "resource") appState.lastAdded = null
}

function renderMarketplace() {
  const marketplaceGrid = document.getElementById("marketplaceGrid")
  if (!marketplaceGrid) return

  if (appState.marketplaceItems.length === 0) {
    marketplaceGrid.innerHTML = '<div class="empty-state"><p>No items listed yet. Post something to sell!</p></div>'
    return
  }

  let arr = appState.marketplaceItems || []

  let banner = ""
  if (appState.viewMyPurchases) {
    const uid = appState.currentUser?.regNumber || ""
    arr = arr.filter((i) => i.purchasedBy === uid)
    banner = `<div class="filter-banner">Showing: My Purchases <button class="chip small" onclick="clearSpecialFilters()">Clear</button></div>`
  }

  marketplaceGrid.innerHTML =
    banner +
    arr
      .map((item) => {
        const itemId = item._id || item.id
        const isNew = appState.lastAdded?.type === "marketplace" && appState.lastAdded.id === itemId
        const me = appState.currentUser?.name || ""
        const isSeller =
          (item.uploadedBy?._id || item.uploadedBy?.id || item.uploadedBy) === (appState.currentUser?.id || "")
        const canDelete = isSeller || isAdmin()
        const canBuy = !isSeller && !item.sold

        const buyBtn = canBuy
          ? `<p style="font-size:.85rem;color:var(--text-secondary);margin-top:.5rem;padding:.75rem;background:rgba(148,163,184,0.1);border-radius:.25rem;border-left:3px solid var(--primary);">To purchase this item, contact the seller at ${withIcon("phone", " " + (item.contact || "N/A"))}</p>`
          : ""

        const sellerBtns = isSeller
          ? `<div class="btn-group" style="display:flex;gap:.5rem;margin-top:.5rem;">
              <button class="btn btn-secondary btn-small" onclick="toggleSold('${itemId}')">${item.sold ? "Mark as Available" : "Mark as Sold"}</button>
            </div>`
          : ""
        const extraDelete = canDelete
          ? `<button class="btn btn-secondary btn-small" style="margin-top:.5rem;" onclick="deleteMarketplaceItem('${itemId}')">Delete</button>`
          : ""
        const status =
          item.sold && item.purchasedBy
            ? `<span class="verified-badge" style="background:#d1fae5;color:#065f46">PURCHASED</span>`
            : item.sold
              ? `<span class="verified-badge" style="background:#ffe8e8;color:#8b0000">SOLD</span>`
              : ""

        const uploaderName =
          typeof item.uploadedBy === "object"
            ? item.uploadedBy?.fullName || item.uploadedBy?.name || item.uploaderName || "-"
            : item.uploaderName || item.uploadedBy || "-"

        return `
        <div class="marketplace-item ${item.sold ? "sold" : ""}" data-item-id="${itemId}" ${isNew ? 'data-new="true"' : ""}>
          <div class="item-image">
            ${item.image ? `<img src="${item.image}" alt="Item image" style="width:100%;height:160px;object-fit:cover;border-radius:.5rem"/>` : `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#8fb6d9" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6h15l-1.5 9h-12z"/><circle cx="9" cy="20" r="1.8"/><circle cx="18" cy="20" r="1.8"/><path d="M6 6L5 3H2"/></svg>`}
          </div>
          <div class="item-details">
            <h3>${item.title} ${status}</h3>
            <div class="item-price">₹${item.price}</div>
            <p class="item-description">${item.description || "No description"}</p>
            <p class="item-contact">${withIcon("phone", " " + (item.contact || "-"))}</p>
            <p style="font-size:.75rem;color:var(--text-secondary);margin-top:.5rem;">Posted by ${uploaderName} • ${formatDate(item.createdAt)}</p>
            ${buyBtn}
            ${sellerBtns}
            ${extraDelete}
          </div>
        </div>`
      })
      .join("")
  if (appState.lastAdded?.type === "marketplace") appState.lastAdded = null
}

function renderEvents() {
  const list = document.getElementById("eventsGrid") || document.getElementById("organizerEvents")
  if (!list) return
  if ((appState.events || []).length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No events yet. Check back later!</p></div>'
    return
  }

  const page = (window.location.pathname.split("/").pop() || "").toLowerCase()
  const isStudentOrFaculty = page.includes("student-dashboard") || page.includes("teacher-dashboard")

  list.innerHTML = appState.events
    .map((e) => {
      const poster = e.image
        ? `<img src="${e.image}" alt="Event poster" style="width:100%;height:140px;object-fit:cover;border-radius:.5rem .5rem 0 0"/>`
        : `<div style="width:100%;height:140px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);display:flex;align-items:center;justify-content:center;border-radius:.5rem .5rem 0 0"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>`

      const controls = isStudentOrFaculty
        ? `${e.formLink ? `<button class="btn btn-primary btn-small" ${e.registrationClosed ? "disabled" : ""} onclick="registerForEvent('${e.id}')">${e.registrationClosed ? "Registration Closed" : "Register"}</button>` : ""}`
        : `<div class="btn-group" style="display:flex;gap:.5rem;">
             <button class="btn btn-secondary btn-small" onclick="closeEventRegistration('${e.id}')" ${e.registrationClosed ? "disabled" : ""}>${e.registrationClosed ? "Closed" : "Close Reg"}</button>
             <button class="btn btn-secondary btn-small" onclick="deleteEvent('${e.id}')">Delete</button>
           </div>`

      const formattedDate = e.date ? formatDate(e.date) : "-"

      return `
        <div class="event-card" data-event-id="${e.id}">
          <div class="event-poster">${poster}</div>
          <div class="event-content">
            <h3>${e.title}</h3>
            <div class="event-meta">
              <span>${withIcon("calendar", " " + formattedDate)}</span>
              <span>${withIcon("pin", " " + (e.venue || "-"))}</span>
            </div>
            <p class="event-description">${e.description || ""}</p>
            ${controls}
          </div>
        </div>`
    })
    .join("")
}

function renderLostFound() {
  const lostFoundList = document.getElementById("lostFoundList")
  if (!lostFoundList) return
  const activeTab = document.querySelector(".chip.active")?.getAttribute("data-lf-tab") || "all"
  const term = (document.getElementById("lfSearch")?.value || "").toLowerCase().trim()

  let arr = appState.lostFoundItems || []
  if (activeTab !== "all") arr = arr.filter((x) => x.type === activeTab)
  if (term) {
    arr = arr.filter(
      (x) =>
        (x.itemName || "").toLowerCase().includes(term) ||
        (x.location || "").toLowerCase().includes(term) ||
        (x.description || "").toLowerCase().includes(term),
    )
  }

  if (arr.length === 0) {
    lostFoundList.innerHTML = '<div class="empty-state"><p>No lost or found items reported.</p></div>'
    return
  }

  const me = appState.currentUser.name || ""
  lostFoundList.innerHTML = arr
    .map((item) => {
      const isNew = appState.lastAdded?.type === "lostfound" && appState.lastAdded.id === item.id
      const canDelete =
        (item.postedBy?._id || item.postedBy?.id || item.postedBy) === (appState.currentUser?.id || "") || isAdmin()

      const posterName =
        typeof item.postedBy === "object"
          ? item.postedBy?.fullName || item.postedBy?.name || item.posterName || "-"
          : item.posterName || item.postedBy || "-"

      return `
        <div class="lost-found-item" data-lf-id="${item.id}" ${isNew ? 'data-new="true"' : ""}>
          ${item.image ? `<img class="lf-image" src="${item.image}" alt="Item image">` : `<div class="lf-image" aria-hidden="true"></div>`}
          <div class="lf-content">
            <span class="lf-type ${item.type}">${item.type.toUpperCase()}</span>
            <h3>${item.itemName}</h3>
            <p>${item.description || ""}</p>
            <div class="lf-meta">
              <span>${withIcon("map-pin", " " + (item.location || "-"))}</span>
              <span>${withIcon("phone", " " + (item.contact || "-"))}</span>
              <span>${withIcon("user", " " + posterName)}</span>
              <span>${withIcon("calendar", " " + formatDate(item.createdAt))}</span>
            </div>
            ${canDelete ? `<div class="lf-actions" style="margin-top:.5rem;"><button class="btn btn-secondary btn-small" onclick="deleteLostFound('${item.id}')">Delete</button></div>` : ""}
          </div>
        </div>
      `
    })
    .join("")
}

function toggleReplyInput(postId) {
  const replyInputContainer = document.getElementById(`reply-input-${postId}`)
  if (replyInputContainer) {
    replyInputContainer.style.display = replyInputContainer.style.display === "none" ? "block" : "none"
  }
}

async function sendReply(postId) {
  const replyInput = document.getElementById(`reply-text-${postId}`)
  const replyText = replyInput?.value?.trim()

  if (!replyText) {
    alert("Reply cannot be empty")
    return
  }

  try {
    console.log("[v0] Sending reply to post:", postId)

    const response = await apiCall(`/community/${postId}/reply`, {
      method: "POST",
      body: JSON.stringify({ message: replyText }),
    })

    if (response.comments) {
      replyInput.value = ""
      // Reload community posts from backend
      await loadDataFromBackend()
      showNotification("Reply posted successfully")
      // Close the reply input after successful post
      toggleReplyInput(postId)
    }
  } catch (error) {
    console.error("[v0] Reply failed:", error)
    alert(`Reply failed: ${error.message}`)
  }
}

function renderDiscussions() {
  const discussionsList = document.getElementById("discussionsList")
  if (!discussionsList) return

  const discussions = appState.discussions || []
  const announcements = (appState.posts || []).filter((p) => p.type === "announcement") || []
  const arr = [...discussions, ...announcements]

  const discussionsFilter = document.getElementById("discussionsFilter")
  const selectedCategory = discussionsFilter ? discussionsFilter.value : "All"

  let filteredArr = arr
  if (selectedCategory === "All" || selectedCategory==="") {
    // ✅ Show all discussions + announcements when "All" is selected
    filteredArr = arr
  } else {
    filteredArr = arr.filter((d) => {
      const category =
        d.type === "announcement" ? "events" : d.category || "general"
      return category.toLowerCase() === selectedCategory.toLowerCase()
    })
  }
  

  if (filteredArr.length === 0) {
    discussionsList.innerHTML = '<div class="empty-state"><p>No discussions yet. Start a conversation!</p></div>'
    return
  }
  const votes = getUserVotes()

  discussionsList.innerHTML = filteredArr
    .map((d) => {
      const myVote = votes.discussions?.[d.id]
      const isNew = appState.lastAdded?.type === "discussion" && appState.lastAdded.id === d.id
      const comments = (d.comments || [])
        .map(
          (c) =>
            `<div class="comment">
         <strong>${c.userName || "User"}:</strong> ${c.message || ""}
       </div>`,
        )
        .join("")

      const replyCount = (d.comments || []).length

      const posterName =
        typeof d.postedBy === "object" ? d.postedBy?.fullName || d.postedBy?.name || "-" : d.postedBy || "-"
      const posterId = typeof d.postedBy === "object" ? d.postedBy?._id || d.postedBy?.id : d.postedBy
      const currentUserId = appState.currentUser?._id || appState.currentUser?.id
      const currentUserName = appState.currentUser?.name || ""
      const canDelete = currentUserName === posterName || currentUserId === posterId

      const category = d.type === "announcement" ? "events" : d.category || "general"

      return `
        <div class="discussion-item" data-discussion-id="${d.id}" ${isNew ? 'data-new="true"' : ""}>
          <div class="discussion-header">
            <h3>${d.title}</h3>
            <span class="discussion-category">${category}</span>
          </div>
          <p class="discussion-content">${d.content}</p>
          <div class="discussion-footer">
            <span>Posted by ${posterName} • ${formatDate(d.postedAt)}</span>
            <div class="discussion-actions">
              <button class="btn btn-secondary btn-small ${myVote === "up" ? "active" : ""}" onclick="upvoteDiscussion('${d.id}')">${withIcon("arrow-up", " " + (d.upvotes || 0))}</button>
              <button class="btn btn-secondary btn-small ${myVote === "down" ? "active" : ""}" onclick="downvoteDiscussion('${d.id}')">👎 ${d.downvotes || 0}</button>
              <button class="btn btn-secondary btn-small" onclick="toggleReplies('${d.id}')" id="toggleRepliesBtn-${d.id}">View replies (${replyCount})</button>
              ${canDelete ? `<button class="btn btn-secondary btn-small" onclick="deleteDiscussion('${d.id}')">Delete</button>` : ""}
            </div>
          </div>
          <div class="comments-list collapsed" id="comments-${d.id}">
            ${comments}
            <div id="reply-input-${d.id}" style="display:none;margin-top:1rem;padding:1rem;background:rgba(255,255,255,0.06);border:1px solid rgba(148,163,184,0.18);border-radius:.5rem;">
              <textarea id="reply-text-${d.id}" placeholder="Write your reply..." style="width:100%;padding:.5rem;border:1px solid #3a4a62;border-radius:.25rem;font-family:inherit;font-size:inherit;resize:vertical;min-height:60px;background:#0f1a2c;color:#eaf2ff;"></textarea>
              <div style="display:flex;gap:.5rem;margin-top:.5rem;">
                <button class="btn btn-primary btn-small" onclick="sendReply('${d.id}')">Send Reply</button>
                <button class="btn btn-secondary btn-small" onclick="toggleReplyInput('${d.id}')">Cancel</button>
              </div>
            </div>
            <button class="btn btn-secondary btn-small" onclick="toggleReplyInput('${d.id}')" style="margin-top:.5rem;">Add Reply</button>
          </div>
        </div>
      `
    })
    .join("")
}

function renderOrganizerEvents() {
  const container = document.getElementById("organizerEventsList")
  if (!container) return

  const me = appState.currentUser?._id || appState.currentUser?.id
  const myEvents = (appState.events || []).filter((e) => {
    const eventCreator = e.createdBy?._id || e.createdBy?.id || e.createdBy
    return eventCreator === me
  })

  console.log("[v0] Rendering organizer events. Total events:", appState.events.length, "My events:", myEvents.length)

  if (myEvents.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No events yet. Create one!</p>'
    return
  }

  container.innerHTML = myEvents
    .map((e) => {
      const eventId = e._id || e.id
      const eventImage = e.image || e.poster || "/public/images/event-icon.png" // Use normalized 'image' field
      const isRegistrationClosed = e.registrationClosed || false

      return `
        <div class="event-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; overflow: hidden; margin-bottom: 1.5rem; color: white; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
          <!-- Event Image -->
          <div style="width: 100%; height: 200px; overflow: hidden; background: rgba(0,0,0,0.1);">
            <img src="${eventImage}" alt="${e.title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/public/images/event-icon.png'"/>
          </div>
          
          <!-- Event Details -->
          <div style="padding: 1.5rem;">
            <h3 style="margin: 0 0 0.75rem 0; font-size: 1.5rem; font-weight: 600;">${e.title || "Untitled Event"}</h3>
            
            <div style="display: flex; gap: 1rem; margin-bottom: 1rem; font-size: 0.95rem; opacity: 0.95;">
              <span>📅 ${e.date ? new Date(e.date).toLocaleDateString() : "Date not set"}</span>
              <span>📍 ${e.venue || "Location not set"}</span>
            </div>
            
            <p style="margin: 0 0 1rem 0; opacity: 0.9; line-height: 1.5;">${e.description || "No description provided"}</p>
            
            <!-- Action Buttons -->
            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
              <button onclick="closeEventRegistration('${eventId}')" style="background: ${isRegistrationClosed ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.2)"}; border: 1px solid white; color: white; padding: 0.6rem 1.2rem; border-radius: 6px; cursor: pointer; font-weight: 500; transition: all 0.3s ease;" ${isRegistrationClosed ? "disabled" : ""}>${isRegistrationClosed ? "Registration Closed" : "Close Registration"}</button>
              <button onclick="deleteEvent('${eventId}')" style="background: rgba(255,255,255,0.2); border: 1px solid white; color: white; padding: 0.6rem 1.2rem; border-radius: 6px; cursor: pointer; font-weight: 500; transition: all 0.3s ease;">Delete</button>
            </div>
          </div>
        </div>
      `
    })
    .join("")
}

function renderAnnouncements() {
  const container = document.getElementById("announcementsList")
  if (!container) return

  const me = appState.currentUser?._id || appState.currentUser?.id
  const myAnnouncements = (appState.notifications || []).filter((a) => {
    const announcementCreator = a.postedBy?._id || a.postedBy?.id || a.postedBy
    return announcementCreator === me
  })

  console.log(
    "[v0] Rendering announcements. Total announcements:",
    appState.notifications.length,
    "My announcements:",
    myAnnouncements.length,
  )

  if (myAnnouncements.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No announcements yet.</p>'
    return
  }

  container.innerHTML = myAnnouncements
    .map((a) => {
      const announcementId = a._id || a.id
      const createdAt = a.createdAt ? new Date(a.createdAt).toLocaleString() : "Unknown date"
      const authorName = a.posterName || a.postedBy?.fullName || a.postedBy?.name || "Unknown"
      return `
        <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div style="flex: 1;">
              <h4 style="margin: 0 0 0.5rem 0; font-size: 1.1rem;">${a.content || "No content"}</h4>
              <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">By ${authorName} • ${createdAt}</p>
            </div>
            <button onclick="deleteAnnouncement('${announcementId}')" style="background: var(--danger-color); color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer;">Delete</button>
          </div>
        </div>
      `
    })
    .join("")
}

// ----- START OF MODIFIED RENDERADMINUSERS -----
function renderAdminUsers() {
  const container = document.getElementById("adminUsersList")
  if (!container) {
    console.warn("[v0] Admin users container not found")
    return
  }

  const searchInput = document.getElementById("adminUserSearch")?.value.toLowerCase() || ""
  const roleFilter = document.getElementById("adminUserRoleFilter")?.value || ""

  let filteredUsers = appState.users || []

  if (searchInput) {
    filteredUsers = filteredUsers.filter((user) => {
      const fullName = (user.fullName || user.name || "").toLowerCase()
      const registeredId = (user.registeredId || "").toLowerCase()
      return fullName.includes(searchInput) || registeredId.includes(searchInput)
    })
  }

  if (roleFilter) {
    filteredUsers = filteredUsers.filter((user) => user.role === roleFilter)
  }

  console.log("[v0] Rendering admin users. Total users:", filteredUsers.length)

  if (!filteredUsers || filteredUsers.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No users match filters.</p>'
    return
  }

  container.innerHTML = filteredUsers
    .map((user) => {
      const userId = user._id || user.id
      const userName = user.fullName || user.name || "Unknown"
      const userRegId = user.registeredId || "No ID"
      const userRole = user.role || "Unknown"
      return `
        <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <p style="margin: 0; font-weight: 500;">${userName}</p>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.9rem; color: var(--text-secondary);">${userRegId} • ${userRole}</p>
          </div>
          <button onclick="deleteUser('${userId}')" style="background: var(--danger-color); color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer;">Delete</button>
        </div>
      `
    })
    .join("")
}
// ----- END OF MODIFIED RENDERADMINUSERS -----

function renderOrganizerRequests() {
  const list = document.getElementById("organizerRequestsList")
  if (!list) return

  const requests = appState.organizerRequests || []
  if (requests.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No pending organizer requests.</p></div>'
    return
  }

  list.innerHTML = requests
    .map(
      (req) => `
    <div class="resource-item">
      <div class="resource-info">
        <h3>${req.name}</h3>
        <div class="resource-meta">
          <span>${withIcon("user", " " + req.by)}</span>
          <span>${withIcon("mail", " " + req.email)}</span>
        </div>
      </div>
      <div class="resource-actions">
        <button class="btn btn-primary btn-small" onclick="approveOrganizer('${req.id}')">Approve</button>
        <button class="btn btn-danger btn-small" onclick="rejectOrganizer('${req.id}')">Reject</button>
      </div>
    </div>
  `,
    )
    .join("")
}

function updateModerationSections() {
  const roleFilter = (document.getElementById("modRoleFilter")?.value || "").toLowerCase()
  const sectionSelect = document.getElementById("modSectionFilter")

  if (!sectionSelect) return

  // Define sections available for each role
  const sectionsByRole = {
    student: ["resources", "lostfound", "marketplace", "community"],
    teacher: ["resources", "community"],
    organizer: ["events", "announcements"],
  }

  // Get available sections for selected role
  const availableSections = sectionsByRole[roleFilter] || []

  // Store current selection
  const currentValue = sectionSelect.value

  // Clear and rebuild options
  sectionSelect.innerHTML = '<option value="">All</option>'

  availableSections.forEach((section) => {
    const label =
      section === "lostfound"
        ? "Lost & Found"
        : section === "marketplace"
          ? "Marketplace"
          : section.charAt(0).toUpperCase() + section.slice(1)
    const option = document.createElement("option")
    option.value = section
    option.textContent = label
    sectionSelect.appendChild(option)
  })

  // Reset to "All" if previous selection is not available
  if (!availableSections.includes(currentValue)) {
    sectionSelect.value = ""
  }
}

function renderModeration() {
  const resList = document.getElementById("moderateResourcesList")
  const evList = document.getElementById("moderateEventsList")
  const annList = document.getElementById("moderateAnnouncementsList")
  const lfList = document.getElementById("moderateLostFoundList")
  const mpList = document.getElementById("moderateMarketplaceList")
  const comList = document.getElementById("moderateCommunityList")

  const roleFilter = (document.getElementById("modRoleFilter")?.value || "").toLowerCase()
  const sectionFilter = (document.getElementById("modSectionFilter")?.value || "").toLowerCase()

  const ready = !!roleFilter && !!sectionFilter

  document.querySelectorAll("[data-mod-section]").forEach((wrap) => {
    const key = wrap.getAttribute("data-mod-section")
    wrap.classList.toggle("hidden", !ready || key !== sectionFilter)
  })

  if (!ready) {
    const placeholder = '<div class="empty-state"><p>Select a role and section to view items.</p></div>'
    if (resList) resList.innerHTML = placeholder
    if (evList) evList.innerHTML = placeholder
    if (annList) annList.innerHTML = placeholder
    if (lfList) lfList.innerHTML = placeholder
    if (mpList) mpList.innerHTML = placeholder
    if (comList) comList.innerHTML = placeholder
    return
  }

  if (resList && sectionFilter === "resources") {
    const arr = (appState.resources || []).filter((r) => {
      const uploaderRole = (r.uploadedByRole || r.uploaderRole || r.posterRole || "").toLowerCase()
      // Map "teacher" to "faculty" for comparison
      const normalizedRole = uploaderRole === "teacher" ? "faculty" : uploaderRole
      const normalizedFilter = roleFilter === "teacher" ? "faculty" : roleFilter
      return normalizedRole === normalizedFilter
    })
    resList.innerHTML =
      arr.length === 0
        ? '<div class="empty-state"><p>No resources found.</p></div>'
        : arr
            .map(
              (r) => `
          <div class="resource-item">
            <div class="resource-info">
              <h3>${r.title} ${r.verified ? '<span class="verified-badge">✓ Verified</span>' : ""}</h3>
              <div class="resource-meta">
                <span>${withIcon("book", " " + (r.subject || "-"))}</span>
                <span>${withIcon("branch", " " + (r.branch || "-"))}</span>
                <span>${withIcon("semester", " " + (r.semester || "-"))}</span>
                <span>${withIcon("user", " " + (r.uploaderName || r.uploadedBy || "-"))}</span>
              </div>
            </div>
            <div class="resource-actions">
              <button class="btn btn-secondary btn-small" onclick="deleteResource('${r._id || r.id}')">Delete</button>
            </div>
          </div>`,
            )
            .join("")
  }

  if (evList && sectionFilter === "events") {
    const arrE = (appState.events || []).filter((e) => {
      const organizerRole = (e.organizerRole || e.posterRole || "").toLowerCase()
      return organizerRole === "organizer"
    })
    evList.innerHTML =
      arrE.length === 0
        ? '<div class="empty-state"><p>No events found.</p></div>'
        : arrE
            .map(
              (e) => `
          <div class="event-card">
            <div class="event-content">
              <h3>${e.title}</h3>
              <div class="event-meta">
                <span>${withIcon("calendar", " " + (e.date || "-"))}</span>
                <span>${withIcon("pin", " " + (e.venue || "-"))}</span>
              </div>
              <div class="btn-group" style="display:flex;gap:.5rem;">
                <button class="btn btn-secondary btn-small" onclick="deleteEvent('${e._id || e.id}')">Delete</button>
              </div>
            </div>
          </div>`,
            )
            .join("")
  }

  if (annList && sectionFilter === "announcements") {
    const arrA = (appState.notifications || []).filter((a) => {
      const posterRole = (a.posterRole || "").toLowerCase()
      return posterRole === "organizer"
    })
    annList.innerHTML =
      arrA.length === 0
        ? '<div class="empty-state"><p>No announcements found.</p></div>'
        : arrA
            .map(
              (a) => `
          <div class="resource-item">
            <div class="resource-info">
              <h3>${a.title || "Announcement"}</h3>
              <p>${a.content || ""}</p>
              <div class="resource-meta">
                <span>${withIcon("user", " " + (a.posterName || "-"))}</span>
              </div>
            </div>
            <div class="resource-actions">
              <button class="btn btn-secondary btn-small" onclick="deleteAnnouncement('${a._id || a.id}')">Delete</button>
            </div>
          </div>`,
            )
            .join("")
  }

  if (lfList && sectionFilter === "lostfound") {
    const arrLF = (appState.lostFoundItems || []).filter((lf) => {
      const posterRole = (lf.postedByRole || lf.posterRole || "").toLowerCase()
      return posterRole === "student"
    })
    if (lfList && sectionFilter === "lostfound") {
      const arrLF = (appState.lostFoundItems || []).filter((lf) => {
        const posterRole = (lf.postedByRole || lf.posterRole || "").toLowerCase()
        return posterRole === "student"
      })
    
      lfList.innerHTML =
        arrLF.length === 0
          ? '<div class="empty-state"><p>No lost & found items found.</p></div>'
          : arrLF
              .map((lf) => {
                const posterName =
                  typeof lf.postedBy === "object"
                    ? lf.postedBy.fullName || lf.postedBy.name || "-"
                    : lf.postedBy || "-"
    
                return `
              <div class="resource-item">
                <div class="resource-info">
                  <h3>${lf.itemName}</h3>
                  <p>${lf.description || ""}</p>
                  <div class="resource-meta">
                    <span>${withIcon("user", " " + posterName)}</span>
                    <span>${withIcon("map-pin", " " + (lf.location || "-"))}</span>
                  </div>
                </div>
                <div class="resource-actions">
                  <button class="btn btn-secondary btn-small" onclick="deleteLostFound('${lf._id || lf.id}')">Delete</button>
                </div>
              </div>`
              })
              .join("")
    }
    
  }

  if (mpList && sectionFilter === "marketplace") {
    const arrMP = (appState.marketplaceItems || []).filter((mp) => {
      const uploaderRole = (mp.uploaderRole || mp.posterRole || mp.postedByRole || "").toLowerCase()
      // Map "teacher" to "faculty" for comparison
      const normalizedRole = uploaderRole === "teacher" ? "faculty" : uploaderRole
      const normalizedFilter = roleFilter === "teacher" ? "faculty" : roleFilter
      return normalizedRole === normalizedFilter
    })
    mpList.innerHTML =
      arrMP.length === 0
        ? '<div class="empty-state"><p>No marketplace items found.</p></div>'
        : arrMP
            .map(
              (mp) => `
          <div class="resource-item">
            <div class="resource-info">
              <h3>${mp.title || mp.itemName}</h3>
              <p>${mp.description || ""}</p>
              <div class="resource-meta">
                <span>${withIcon("user", " " + (mp.uploaderName || mp.postedBy || "-"))}</span>
                <span>${withIcon("tag", " ₹" + (mp.price || "-"))}</span>
              </div>
            </div>
            <div class="resource-actions">
              <button class="btn btn-secondary btn-small" onclick="deleteMarketplaceItem('${mp._id || mp.id}')">Delete</button>
            </div>
          </div>`,
            )
            .join("")
  }

  if (comList && sectionFilter === "community") {
    const arrCom = (appState.discussions || []).filter((post) => {
      const posterRole = (post.posterRole || "").toLowerCase()
      // Map "teacher" to "faculty" for comparison
      const normalizedRole = posterRole === "teacher" ? "faculty" : posterRole
      const normalizedFilter = roleFilter === "teacher" ? "faculty" : roleFilter
      // Community posts can be from students or faculty (non-announcement posts)
      return normalizedRole === normalizedFilter
    })
    comList.innerHTML =
      arrCom.length === 0
        ? '<div class="empty-state"><p>No community posts found.</p></div>'
        : arrCom
            .map(
              (post) => `
          <div class="resource-item">
            <div class="resource-info">
              <h3>${post.title || "Community Post"}</h3>
              <p>${post.content || ""}</p>
              <div class="resource-meta">
                <span>${withIcon("user", " " + (post.posterName || "-"))}</span>
                <span>${withIcon("tag", " " + (post.category || "-"))}</span>
              </div>
            </div>
            <div class="resource-actions">
              <button class="btn btn-secondary btn-small" onclick="deletePost('${post._id || post.id}')">Delete</button>
            </div>
          </div>`,
            )
            .join("")
  }
}

// THIS IS THE UPDATED renderPendingVerification FUNCTION
function renderPendingVerification() {
  const host = document.getElementById("pendingVerifyList")
  if (!host) return

  let arr = (appState.resources || []).filter((r) => r.status === "pending" && !r.verified)

  // Apply search filter
  const searchInput = document.getElementById("verifySearch")
  if (searchInput && searchInput.value.trim()) {
    const query = searchInput.value.toLowerCase()
    arr = arr.filter(
      (r) => r.title.toLowerCase().includes(query) || (r.subject && r.subject.toLowerCase().includes(query)),
    )
  }

  // Apply semester filter
  const semesterSelect = document.getElementById("verifySemester")
  if (semesterSelect && semesterSelect.value) {
    arr = arr.filter((r) => r.semester === semesterSelect.value)
  }

  // Apply branch filter
  const branchSelect = document.getElementById("verifyBranch")
  if (branchSelect && branchSelect.value) {
    arr = arr.filter((r) => r.branch === branchSelect.value)
  }

  if (arr.length === 0) {
    host.innerHTML = '<div class="empty-state"><p>No pending notes to verify.</p></div>'
    return
  }

  host.innerHTML = arr
    .map(
      (r) => `
      <div class="resource-item">
        <div class="resource-info">
          <h3>${r.title}</h3>
          <p>${r.description || ""}</p>
          <small>${r.subject || ""} • ${r.branch || ""} • ${r.semester || ""}</small>
        </div>
        <div class="resource-actions">
          <button class="btn btn-primary btn-small" onclick="verifyResource('${r._id || r.id}')">Verify</button>
        </div>
      </div>`,
    )
    .join("")
}

function renderMyUploads() {
  const host = document.getElementById("myUploadsList")
  if (!host) return

  let arr = (appState.resources || []).filter(
    (r) => (r.uploadedBy?._id || r.uploadedBy?.id || r.uploadedBy) === (appState.currentUser?.id || ""),
  )

  // Apply filters
  const yearFilter = document.getElementById("myYearFilter")?.value || ""
  const semFilter = document.getElementById("mySemFilter")?.value || ""

  if (yearFilter) {
    arr = arr.filter((r) => {
      const sem = r.semester || ""
      // Basic logic to extract year from semester string like "2023-2024 Sem 1"
      const match = sem.match(/(\d{4})-(\d{4})/)
      if (match) {
        const startYear = Number.parseInt(match[1], 10)
        return startYear.toString() === yearFilter
      }
      return false // Semester format not recognized or doesn't match year
    })
  }
  if (semFilter) arr = arr.filter((r) => r.semester === semFilter)

  if (arr.length === 0) {
    host.innerHTML = '<div class="empty-state"><p>You haven\'t uploaded any resources yet.</p></div>'
    return
  }

  const votes = getUserVotes()

  host.innerHTML = arr
    .map((r) => {
      const resourceId = r._id || r.id
      const voted = votes.resources?.[resourceId] === "up"
      return `
      <div class="resource-item">
        <div class="resource-info">
          <h3>${r.title}${r.verified ? ' <span class="verified-badge">✓ Verified</span>' : ""}</h3>
          <p>${r.description || "No description"}</p>
          <div class="resource-meta">
            <span>${withIcon("book", " " + (r.subject || "-"))}</span>
            <span>${withIcon("tag", " " + (r.branch || "-") + " • " + (r.semester || "-"))}</span>
            <span>${withIcon("calendar", " " + formatDate(r.uploadedAt))}</span>
          </div>
        </div>
        <div class="resource-actions">
          <button class="btn btn-secondary btn-small ${voted ? "active" : ""}" aria-pressed="${voted}" onclick="upvoteResource('${resourceId}')">${withIcon("arrow-up", " " + (r.upvotes || 0))}</button>
          <button class="btn btn-primary btn-small" onclick="downloadResource('${resourceId}')">${withIcon("download", " " + (r.downloads || 0))}</button>
          <button class="btn btn-secondary btn-small" onclick="deleteResource('${resourceId}')">Delete</button>
        </div>
      </div>`
    })
    .join("")
  host.style.display = "grid"
}

function renderMyPurchases() {
  const host = document.getElementById("myPurchasesGrid")
  if (!host) return
  const uid = appState.currentUser?.regNumber || ""
  const arr = (appState.marketplaceItems || []).filter((i) => i.purchasedBy === uid)
  if (arr.length === 0) {
    host.innerHTML = '<div class="empty-state"><p>No purchases yet.</p></div>'
    return
  }
  host.innerHTML = arr
    .map(
      (i) => `
      <div class="marketplace-item sold" data-item-id="${i.id}">
        <div class="item-image">
          ${
            i.image
              ? `<img src="${i.image}" alt="Purchased item" style="width:100%;height:160px;object-fit:cover;border-radius:.5rem"/>`
              : ""
          }
        </div>
        <div class="item-details">
          <h3>${i.title} <span class="verified-badge" style="background:#d1fae5;color:#065f46">PURCHASED</span></h3>
          <div class="item-price">₹${i.price}</div>
          <p class="item-description">${i.description || ""}</p>
          <p class="item-contact">Contact: ${i.contact}</p>
          <p style="font-size:.75rem;color:var(--text-secondary);margin-top:.5rem;">From ${i.postedBy} • ${formatDate(i.postedAt)}</p>
        </div>
      </div>`,
    )
    .join("")
}

// ===== ACTION FUNCTIONS =====
async function downloadResource(resourceId) {
  try {
    const idStr = String(resourceId).trim()
    if (!idStr || idStr === "undefined") {
      throw new Error("Invalid resource ID")
    }

    const resource = appState.resources.find((r) => String(r._id || r.id) === idStr)
    if (!resource) {
      console.error("[v0] Resource not found for download")
      return
    }

    const actualResourceId = resource._id || resource.id
    let url = resource.fileUrl

    // If no URL exists, create a fallback blob
    if (!url) {
      const blob = new Blob([resource.title + "\n\n" + (resource.description || "No description")], {
        type: "text/plain",
      })
      url = URL.createObjectURL(blob)
    }

    try {
      await apiCall(`/resources/${actualResourceId}/download`, {
        method: "POST",
      })
    } catch (downloadTrackError) {
      console.warn("[v0] Could not track download on backend:", downloadTrackError)
      // Continue with download even if tracking fails
    }

    // Create download link and trigger download
    const link = document.createElement("a")
    link.href = url
    link.download = resource.fileName || "resource"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Reload data to show updated download count
    await loadDataFromBackend()
    showNotification("Resource downloaded successfully")
    console.log("[v0] Downloaded resource:", resource.title)
  } catch (error) {
    console.error("[v0] Download failed:", error)
    alert(`Download failed: ${error.message}`)
  }
}

async function registerForEvent(eventId) {
  try {
    const event = appState.events?.find((e) => (e._id || e.id) === eventId)

    if (!event) {
      alert("Event not found")
      return
    }

    if (!event.formLink) {
      alert("No registration form available for this event")
      return
    }

    window.open(event.formLink, "_blank")

    await apiCall(`/events/${eventId}/register`, { method: "PUT" })

    // Reload events to get updated registration status
    await loadDataFromBackend()
    showNotification("Redirecting to registration form...")
  } catch (error) {
    console.error("Registration failed:", error)
    alert(`Registration failed: ${error.message}`)
  }
}

function getUserId() {
  return appState?.currentUser?.regNumber || "anon"
}
function getUserVotes() {
  const key = "votes_" + getUserId()
  try {
    return JSON.parse(localStorage.getItem(key)) || { discussions: {}, resources: {} }
  } catch {
    return { discussions: {}, resources: {} }
  }
}
function setUserVotes(v) {
  const key = "votes_" + getUserId()
  localStorage.setItem(key, JSON.stringify(v))
}

function likeDiscussion(discussionId) {
  const discussion = appState.discussions.find((d) => d.id === discussionId)
  if (discussion) {
    discussion.likes++
    saveStateToStorage()
    renderDiscussions()

    console.log("[v0] Liked discussion:", discussion)
  }
}

// Replaced duplicate verifyResource function with the one from the updates.
async function verifyResource(id) {
  try {
    console.log("[v0] Verifying resource with ID:", id)

    if (!id || id === "undefined") {
      throw new Error("Invalid resource ID")
    }

    await apiCall(`/resources/${id}/verify`, { method: "PUT" })

    await loadDataFromBackend()

    showNotification("Resource verified successfully")

    renderPendingVerification()
    updateFacultyStats()
  } catch (error) {
    console.error("[v0] Verification failed:", error)
    alert(`Verification failed: ${error.message}`)
  }
}

function approveResource(id) {
  console.log("[v0] Approving resource with id:", id)
  const r = (appState.resources || []).find((x) => x.id === id)
  if (r) {
    console.log("[v0] Found resource:", r)
    r.verified = true
    r.status = "verified" // Update status to verified
    saveStateToStorage()
    renderResources()
    renderPendingVerification()
    showNotification("Note approved and verified!")
    console.log("[v0] Resource approved successfully")
  } else {
    console.log("[v0] Resource not found with id:", id)
  }
}

function rejectResource(id) {
  console.log("[v0] Rejecting resource with id:", id)
  const r = (appState.resources || []).find((x) => x.id === id)
  if (r) {
    r.status = "rejected" // Update status to rejected
    saveStateToStorage()
    renderResources()
    renderPendingVerification()
    showNotification("Note rejected!")
    console.log("[v0] Resource rejected successfully")
  } else {
    console.log("[v0] Resource not found with id:", id)
  }
}

async function deleteResource(id) {
  try {
    const idStr = String(id).trim()
    if (!idStr || idStr === "undefined") {
      throw new Error("Invalid resource ID")
    }

    console.log("[v0] Deleting resource with ID:", idStr)

    // Find the resource to get the correct ID format
    const resource = appState.resources.find((r) => String(r._id || r.id) === idStr)
    const actualResourceId = resource?._id || resource?.id || idStr

    // Confirm deletion
    if (!confirm("Are you sure you want to delete this resource? This action cannot be undone.")) {
      return
    }

    // Call delete API
    const response = await apiCall(`/resources/${actualResourceId}`, { method: "DELETE" })
    console.log("[v0] Delete response:", response)

    // Reload all data from backend to ensure consistency
    await loadDataFromBackend()
    showNotification("Resource deleted successfully")
  } catch (error) {
    console.error("[v0] Delete failed:", error)
    alert(`Delete failed: ${error.message}`)
  }
}

async function upvoteResource(id) {
  try {
    const idStr = String(id).trim()
    if (!idStr || idStr === "undefined") {
      throw new Error("Invalid resource ID")
    }
    await apiCall(`/resources/${idStr}/upvote`, { method: "PUT" })
    // Reload resources to get updated counts
    await loadDataFromBackend()
    showNotification("Vote updated")
  } catch (error) {
    console.error("Upvote failed:", error)
    alert(`Vote failed: ${error.message}`)
  }
}

async function deleteEvent(id) {
  try {
    await apiCall(`/events/${id}`, { method: "DELETE" })
    // Reload events from backend
    await loadDataFromBackend()
    showNotification("Event deleted")
  } catch (error) {
    console.error("Delete failed:", error)
    alert(`Delete failed: ${error.message}`)
  }
}

function toggleEventClosed(id) {
  const ev = (appState.events || []).find((e) => e.id === id)
  if (!ev) return
  ev.closed = !ev.closed // This is likely intended for event.registrationClosed
  saveStateToStorage()
  renderEvents()
  renderOrganizerEvents()
}

async function closeEventRegistration(eventId) {
  try {
    console.log("[v0] Closing registration for event:", eventId)

    await apiCall(`/events/${eventId}/close-registration`, { method: "PUT" })

    // Reload events from backend
    await loadDataFromBackend()
    showNotification("Event registration closed successfully!")
  } catch (error) {
    console.error("Close registration failed:", error)
    alert(`Failed to close registration: ${error.message}`)
  }
}

async function deleteLostFound(id) {
  try {
    console.log("[v0] Deleting lost/found item with ID:", id)

    if (!id || id === "undefined") {
      throw new Error("Invalid item ID")
    }

    await apiCall(`/lostfound/${id}`, { method: "DELETE" })
    await loadDataFromBackend()
    showNotification("Lost/Found item deleted")
  } catch (error) {
    console.error("[v0] Delete failed:", error)
    alert(`Delete failed: ${error.message}`)
  }
}

async function upvoteDiscussion(id) {
  try {
    console.log("[v0] Upvoting discussion with ID:", id)

    if (!id || id === "undefined") {
      throw new Error("Invalid discussion ID")
    }

    await apiCall(`/community/${id}/upvote`, { method: "POST", body: JSON.stringify({ action: "upvote" }) })
    await loadDataFromBackend()
    showNotification("Vote updated")
  } catch (error) {
    console.error("[v0] Upvote failed:", error)
    alert(`Upvote failed: ${error.message}`)
  }
}

async function downvoteDiscussion(id) {
  try {
    console.log("[v0] Downvoting discussion with ID:", id)

    if (!id || id === "undefined") {
      throw new Error("Invalid discussion ID")
    }

    await apiCall(`/community/${id}/downvote`, { method: "POST", body: JSON.stringify({ action: "downvote" }) })
    await loadDataFromBackend()
    showNotification("Vote updated")
  } catch (error) {
    console.error("[v0] Downvote failed:", error)
    alert(`Downvote failed: ${error.message}`)
  }
}

async function addComment(id) {
  try {
    console.log("[v0] Adding comment to discussion with ID:", id)

    if (!id || id === "undefined") {
      throw new Error("Invalid discussion ID")
    }

    const commentInput = document.getElementById(`commentInput-${id}`)
    if (!commentInput || !commentInput.value.trim()) {
      alert("Please enter a comment")
      return
    }

    const message = commentInput.value.trim()

    await apiCall(`/community/${id}/reply`, {
      method: "POST",
      body: JSON.stringify({ message }),
    })

    commentInput.value = ""
    await loadDataFromBackend()
    showNotification("Comment added")
  } catch (error) {
    console.error("[v0] Comment failed:", error)
    alert(`Comment failed: ${error.message}`)
  }
}

function toggleReplies(id) {
  const wrap = document.getElementById(`comments-${id}`)
  const btn = document.getElementById(`toggleRepliesBtn-${id}`)
  if (!wrap) return
  wrap.classList.toggle("collapsed")
  if (btn) btn.textContent = wrap.classList.contains("collapsed") ? "View replies" : "Hide replies"
}

async function deleteDiscussion(id) {
  try {
    await apiCall(`/community/${id}`, { method: "DELETE" })
    // Reload community posts from backend
    await loadDataFromBackend()
    showNotification("Post deleted")
  } catch (error) {
    console.error("Delete failed:", error)
    alert(`Delete failed: ${error.message}`)
  }
}

function approveOrganizer(id) {
  const req = (appState.organizerRequests || []).find((r) => r.id === id)
  if (!req) return
  // In a real app you would create a user here. We only remove request and notify.
  appState.organizerRequests = (appState.organizerRequests || []).filter((r) => r.id !== id)
  showNotification("Organizer approved")
  saveStateToStorage()
  renderOrganizerRequests()
}

function rejectOrganizer(id) {
  appState.organizerRequests = (appState.organizerRequests || []).filter((r) => r.id !== id)
  showNotification("Request rejected")
  saveStateToStorage()
  renderOrganizerRequests()
}

function toggleBan(userId) {
  const u = (appState.users || []).find((x) => x.id === userId)
  if (!u) return
  u.banned = !u.banned
  saveStateToStorage()
  renderAdminUsers()
}

async function deleteUser(userId) {
  try {
    await apiCall(`/admin/users/${userId}`, { method: "DELETE" })
    // Reload users from backend
    await loadDataFromBackend()
    showNotification("User deleted successfully")
  } catch (error) {
    console.error("Delete failed:", error)
    alert(`Delete failed: ${error.message}`)
  }
}

async function buyItem(itemId) {
  try {
    await apiCall(`/marketplace/${itemId}/sold`, {
      method: "PUT",
      body: JSON.stringify({ purchasedBy: appState.currentUser?.id }),
    })
    // Reload marketplace items from backend
    await loadDataFromBackend()
    showNotification("Item purchased successfully")
  } catch (error) {
    console.error("Purchase failed:", error)
    alert(`Purchase failed: ${error.message}`)
  }
}

async function toggleSold(itemId) {
  try {
    console.log("[v0] Toggling sold status for item with ID:", itemId)

    if (!itemId || itemId === "undefined") {
      throw new Error("Invalid item ID")
    }

    await apiCall(`/marketplace/${itemId}/sold`, {
      method: "PUT",
      body: JSON.stringify({ purchasedBy: null }),
    })

    await loadDataFromBackend()
    showNotification("Item status updated")
  } catch (error) {
    console.error("[v0] Status update failed:", error)
    alert(`Status update failed: ${error.message}`)
  }
}

async function deleteMarketplaceItem(itemId) {
  try {
    console.log("[v0] Deleting marketplace item with ID:", itemId)

    if (!itemId || itemId === "undefined") {
      throw new Error("Invalid item ID")
    }

    await apiCall(`/marketplace/${itemId}`, { method: "DELETE" })
    await loadDataFromBackend()
    showNotification("Item deleted")
  } catch (error) {
    console.error("[v0] Delete failed:", error)
    alert(`Delete failed: ${error.message}`)
  }
}

async function postAnnouncement() {
  const textEl = document.getElementById("annText")
  const text = textEl?.value?.trim()
  if (!text) {
    alert("Announcement content is required")
    return
  }

  try {
    const response = await apiCall("/community/announcement", {
      method: "POST",
      body: JSON.stringify({ content: text }),
    })

    if (response.post) {
      textEl.value = ""
      // Reload community posts from backend
      await loadDataFromBackend()
      showNotification("Announcement posted")
    }
  } catch (error) {
    console.error("Announcement failed:", error)
    alert(`Announcement failed: ${error.message}`)
  }
}

function deleteAnnouncement(id) {
  // Instead of filtering from appState.notifications, we should reload from backend
  // or if backend doesn't support deletion, filter appState.posts directly.
  // Assuming backend handles deletion and loadDataFromBackend will refresh the list.
  // For now, let's simulate removal from appState.notifications for immediate UI update.
  // A proper implementation would involve an API call to delete.
  const announcementId = String(id).replace("ann-", "") // Remove prefix if any
  const initialLength = appState.notifications.length
  appState.notifications = appState.notifications.filter((n) => String(n._id || n.id) !== announcementId)
  if (appState.notifications.length < initialLength) {
    showNotification("Announcement deleted")
    renderAnnouncements()
    renderModeration() // Re-render moderation section too
    updateOrganizerStats() // Update counts
  } else {
    console.warn("Announcement not found in appState for deletion:", id)
    // Optionally reload from backend here if direct state manipulation is not reliable
  }
}

function enhanceDrawerAndProfile() {
  // already wired in initializeNavigation(); keep as no-op placeholder for compatibility
}

function roleSpecificCleanup() {
  // You can hide/show sections by role here if needed. Keeping default behavior.
}

function awardPoints(n, reason) {
  appState.points = (appState.points || 0) + (Number(n) || 0)
  saveStateToStorage()
  updateStats()
  if (reason) console.log("[v0] Points awarded:", n, reason)
}

// Password change for current user
async function handlePasswordChange(e) {
  e.preventDefault()

  // Find the password input in the settings section
  const settingsSection = e.target.closest("#settings")
  if (!settingsSection) return

  const passwordInput = settingsSection.querySelector('input[type="password"]')
  if (!passwordInput) return

  const newPassword = passwordInput.value.trim()
  if (!newPassword) {
    alert("Please enter a new password")
    return
  }

  const currentPassword = prompt("Enter your current password:")
  if (!currentPassword) return

  try {
    await apiCall("/auth/change-password", {
      method: "PUT",
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    })

    passwordInput.value = ""
    showNotification("Password changed successfully")
  } catch (error) {
    console.error("Password change failed:", error)
    alert(`Password change failed: ${error.message}`)
  }
}

// Added function for admin to change user password
async function changeUserPassword(userId) {
  try {
    console.log("[v0] Changing password for user with ID:", userId)

    if (!userId || userId === "undefined") {
      throw new Error("Invalid user ID")
    }

    const newPassword = prompt("Enter new password:")
    if (!newPassword) return

    await apiCall(`/admin/users/${userId}/password`, {
      method: "PUT",
      body: JSON.stringify({ newPassword }),
    })

    await loadDataFromBackend()
    showNotification("Password changed successfully")
  } catch (error) {
    console.error("[v0] Password change failed:", error)
    alert(`Password change failed: ${error.message}`)
  }
}

// THIS IS THE UPDATED renderWishlist FUNCTION
function renderWishlist() {
  const host = document.getElementById("wishlistGrid");
  if (!host) return;

  const wishlist = getUserWishlist();
  const arr = (appState.resources || []).filter((r) => {
    const resourceId = r._id || r.id;
    return wishlist.includes(String(resourceId));
  });

  if (arr.length === 0) {
    host.innerHTML =
      '<div class="empty-state"><p>No saved notes yet. Tap the Wishlist icon on a note to save it here.</p></div>';
    return;
  }

  const votes = getUserVotes();

  host.innerHTML = arr
    .map((r) => {
      const resourceId = r._id || r.id;
      const voted = votes.resources?.[resourceId] === "up";
      const saved = true; // Always true since we're in wishlist

      // 🧠 Fix uploader name (avoid [object Object])
      const uploaderName =
        typeof r.uploadedBy === "object"
          ? r.uploadedBy?.fullName || "Unknown User"
          : r.uploadedBy || "Unknown User";

      return `
      <div class="resource-item">
        <div class="resource-info">
          <h3>${r.title}${r.verified ? ' <span class="verified-badge">✓ Verified</span>' : ""}</h3>
          <p>${r.description || "No description"}</p>
          <div class="resource-meta">
            <span>${withIcon("book", " " + (r.subject || "-"))}</span>
            <span>${withIcon("tag", " " + (r.branch || "-") + " • " + (r.semester || "-"))}</span>
            <span>${withIcon("user", " " + uploaderName)}</span>
            <span>${withIcon("calendar", " " + formatDate(r.uploadedAt))}</span>
          </div>
        </div>
        <div class="resource-actions">
          <button class="btn btn-secondary btn-small active" aria-pressed="true" title="Remove from Wishlist" onclick="toggleWishlist('${resourceId}')">🔖 Saved</button>
          <button class="btn btn-secondary btn-small ${voted ? "active" : ""}" aria-pressed="${voted}" onclick="upvoteResource('${resourceId}')">${withIcon("arrow-up", " " + (r.upvotes || 0))}</button>
          <button class="btn btn-primary btn-small" onclick="downloadResource('${resourceId}')">${withIcon("download", " " + (r.downloads || 0))}</button>
          ${(r.uploadedBy?._id || r.uploadedBy) === (appState.currentUser?.id || "") || isAdmin()
            ? `<button class="btn btn-secondary btn-small" onclick="deleteResource('${resourceId}')">Delete</button>`
            : ""}
        </div>
      </div>`;
    })
    .join("");
}


function clearSpecialFilters() {
  appState.viewMyUploads = false
  appState.viewMyPurchases = false
  renderResources()
  renderMarketplace()
}

function updateStudentStats() {
  const resourceCount = (appState.resources || []).length
  // Assuming userRegistrations will hold this data from the backend
  const eventCount = (appState.events || []).length
  const pointsCount = appState.points || 0
  const postCount = (appState.discussions || []).length // Count only discussions, not announcements

  const studentCountMap = {
    resourceCount: resourceCount,
    eventCount: eventCount,
    pointsCount: pointsCount,
    postCount: postCount,
    totalPoints: pointsCount, // Ensure totalPoints is also updated
  }

  Object.entries(studentCountMap).forEach(([id, val]) => {
    const el = document.getElementById(id)
    if (el) el.textContent = String(val)
  })
}

function updateFacultyStats() {
  const resourceCount = (appState.resources || []).length
  const pendingVerifyCount = (appState.resources || []).filter((r) => r.status === "pending").length
  const postCount = (appState.discussions || []).length // Count only discussions

  const facultyCountMap = {
    resourceCount: resourceCount,
    pendingVerifyCount: pendingVerifyCount,
    postCount: postCount,
  }

  Object.entries(facultyCountMap).forEach(([id, val]) => {
    const el = document.getElementById(id)
    if (el) el.textContent = String(val)
  })
}

function updateOrganizerStats() {
  console.log("[v0] Loaded announcements:", appState.notifications.length);

  const eventCount = (appState.events || []).length
  const announcementCount = (appState.notifications || []).length // Count announcements

  const organizerCountMap = {
    orgEventCount: eventCount,
    orgAnnouncementCount: announcementCount,
  }

  Object.entries(organizerCountMap).forEach(([id, val]) => {
    const el = document.getElementById(id)
    if (el) el.textContent = String(val)
  })
}

// Updated updateAdminStats function
function updateAdminStats() {
  const usersCount = (appState.users || []).length
  const eventCount = (appState.events || []).length
  // Count all community posts including discussions and announcements for admin view
  const postCount = (appState.posts || []).length

  const adminCountMap = {
    adminUserCount: usersCount,
    adminEventCount: eventCount,
    adminPostCount: postCount,
  }

  Object.entries(adminCountMap).forEach(([id, val]) => {
    const el = document.getElementById(id)
    if (el) el.textContent = String(val)
  })
}

// Updated updateStats function
function updateStats() {
  const userCount = (appState.users || []).length
  const eventCount = (appState.events || []).length
  const postCount = (appState.posts || []).length
  const resourceCount = (appState.resources || []).length

  console.log(
    "[v0] Updating stats - Users:",
    userCount,
    "Events:",
    eventCount,
    "Posts:",
    postCount,
    "Resources:",
    resourceCount,
  )

  // Admin dashboard stats
  const adminUserCountEl = document.getElementById("adminUserCount")
  const adminEventCountEl = document.getElementById("adminEventCount")
  if (adminUserCountEl) adminUserCountEl.textContent = userCount
  if (adminEventCountEl) adminEventCountEl.textContent = eventCount

  // Organizer dashboard stats
  const orgEventCountEl = document.getElementById("orgEventCount")
  if (orgEventCountEl) orgEventCountEl.textContent = eventCount

  // Student/Teacher dashboard stats
  const resourceCountEl = document.getElementById("resourceCount")
  const eventCountEl = document.getElementById("eventCount")
  if (resourceCountEl) resourceCountEl.textContent = resourceCount
  if (eventCountEl) eventCountEl.textContent = eventCount
}

function loadAndRenderData() {
  renderResources()
  renderMarketplace()
  renderEvents()
  renderLostFound()
  renderDiscussions() // Renders discussions only
  renderAnnouncements() // Explicitly render announcements if needed elsewhere
  renderWishlist()
}

function saveStateToStorage() {
  // Data caching disabled - always fetch fresh from backend
  // This prevents stale data from appearing after deletions or updates
  console.log("[v0] Data caching disabled - using fresh backend data only")
}

function loadStateFromStorage() {
  // Data loading from localStorage disabled
  // All data is now loaded fresh from backend via loadDataFromBackend()
  console.log("[v0] Loading fresh data from backend instead of localStorage")
}

function formatDate(dateInput) {
  if (!dateInput) return "-"

  try {
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput

    if (isNaN(date.getTime())) {
      console.warn("[v0] Invalid date:", dateInput)
      return "-"
    }

    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())

    if (dateOnly.getTime() === todayOnly.getTime()) {
      return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
      return "Yesterday"
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      })
    }
  } catch (error) {
    console.warn("[v0] Error formatting date:", error)
    return "-"
  }
}

function isDigitsOnly(val) {
  return /^[0-9]+$/.test(val || "")
}

function enhanceNumericField(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.addEventListener("input", () => {
    el.value = (el.value || "").replace(/\D+/g, "")
  })
}

function showNotification(msg) {
  // Simple non-blocking toast fallback
  try {
    const n = document.createElement("div")
    n.className = "toast"
    n.textContent = msg
    Object.assign(n.style, {
      position: "fixed",
      bottom: "16px",
      right: "16px",
      background: "rgba(20,25,40,.9)",
      color: "#cfe8ff",
      padding: "10px 14px",
      borderRadius: "10px",
      boxShadow: "0 8px 24px rgba(0,0,0,.3)",
      zIndex: 9999,
    })
    document.body.appendChild(n)
    setTimeout(() => n.remove(), 2000)
  } catch {
    alert(msg)
  }
}

function toggleModal(id) {
  const m = document.getElementById(id)
  if (!m) return
  m.classList.toggle("active")
  m.setAttribute("aria-hidden", m.classList.contains("active") ? "false" : "true")
}

function logout() {
  localStorage.removeItem("currentUser")
  localStorage.removeItem("userRole")
  localStorage.removeItem("authToken") // Remove auth token on logout
  window.location.href = "dashboard.html"
}
