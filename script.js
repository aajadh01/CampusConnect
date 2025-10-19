// Global State Management
const appState = {
  currentUser: null,
  selectedRole: null,
  resources: [],
  marketplaceItems: [],
  events: [],
  lostFoundItems: [],
  discussions: [],
  notifications: [],
  points: 0,
  badges: [],
  users: [],
  organizerRequests: [],
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
    form.addEventListener("submit", (e) => {
      e.preventDefault()
      const name = document.getElementById("auName").value
      const role = document.getElementById("auRole").value
      const reg = document.getElementById("auReg").value
      appState.users.push({ id: Date.now(), name, role, reg, banned: false })
      saveStateToStorage()
      renderAdminUsers()
      updateAdminStats()
      form.reset()
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

  // Student: chat modal send
  const chatSend = document.getElementById("chatSend")
  if (chatSend) {
    chatSend.addEventListener("click", () => {
      const input = document.getElementById("chatInput")
      const body = document.getElementById("chatBody")
      if (input?.value && body) {
        const msg = document.createElement("div")
        msg.className = "chat-message right"
        msg.textContent = input.value
        body.appendChild(msg)
        input.value = ""
        body.scrollTop = body.scrollHeight
      }
    })
  }

  // Admin: restore theme
  const savedTheme = localStorage.getItem("theme")
  if (savedTheme) document.body.setAttribute("data-theme", savedTheme)
  const themeToggle = document.getElementById("toggleTheme")
  if (themeToggle) {
    themeToggle.checked = savedTheme === "dark"
    themeToggle.addEventListener("change", (e) => {
      const theme = e.target.checked ? "dark" : ""
      if (theme) document.body.setAttribute("data-theme", "dark")
      else document.body.removeAttribute("data-theme")
      localStorage.setItem("theme", theme)
    })
  }

  const changePwdButtons = document.querySelectorAll('.dropdown-item[data-action="change-password"]')
  changePwdButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      navigateToSection("settings")
      // close any open profile dropdowns
      document.querySelectorAll(".profile-dropdown").forEach((el) => el.classList.remove("active"))
    })
  })

  enhanceDrawerAndProfile()
  roleSpecificCleanup()
})

// Initialize based on current page
function initializePage() {
  const currentPage = window.location.pathname.split("/").pop()

  if (currentPage === "login.html") {
    initializeLogin()
  } else if (currentPage.includes("dashboard.html") && currentPage !== "dashboard.html") {
    initializeDashboard()
  }

  // Load state from localStorage
  loadStateFromStorage()
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
      placeholder: "23L31A0501",
      hint: "Students: 23L31A0501 | Staff: 11831",
    },
    teacher: {
      title: "Faculty Login",
      placeholder: "11831",
      hint: "Students: 23L31A0501 | Staff: 11831",
    },
    organizer: {
      title: "Organizer Login",
      placeholder: "11831",
      hint: "Students: 23L31A0501 | Staff: 11831",
    },
    admin: {
      title: "Admin Login",
      placeholder: "11831",
      hint: "Students: 23L31A0501 | Staff: 11831",
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

function handleLogin(formData) {
  // Simulate login (placeholder for backend integration)
  appState.currentUser = {
    regNumber: formData.regNumber,
    role: formData.role,
    name: `User_${formData.regNumber.slice(-4)}`,
  }

  localStorage.setItem("currentUser", JSON.stringify(appState.currentUser))

  // Redirect to appropriate dashboard
  redirectToDashboard(formData.role)
}

function redirectToDashboard(role) {
  window.location.href = `${role}-dashboard.html`
}

// ===== DASHBOARD INITIALIZATION =====
function initializeDashboard() {
  // Check if user is logged in
  const currentUser = localStorage.getItem("currentUser")
  if (!currentUser) {
    window.location.href = "dashboard.html"
    return
  }

  appState.currentUser = JSON.parse(currentUser)

  // Update user display
  const userName = document.getElementById("userName")
  const userNameDisplay = document.getElementById("userNameDisplay")
  const userAvatar = document.querySelector(".user-avatar")

  if (userName) userName.textContent = appState.currentUser.name
  if (userNameDisplay) userNameDisplay.textContent = appState.currentUser.name
  if (userAvatar) userAvatar.textContent = appState.currentUser.name.charAt(0).toUpperCase()

  // Initialize navigation
  initializeNavigation()

  // Initialize forms
  initializeForms()

  // Load and render data
  loadAndRenderData()

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

  // Ensure Dashboard opens the Overview on load (fixes student opening Settings)
  if (document.getElementById("overview")) {
    navigateToSection("overview")
  }
}

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
      navigateToSection(targetSection)
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
}

// ===== FORM HANDLERS =====
function handleUploadResource(e) {
  e.preventDefault()

  const formData = {
    id: Date.now(),
    title: document.getElementById("resourceTitle").value,
    subject: document.getElementById("resourceSubject").value,
    description: document.getElementById("resourceDescription").value,
    branch: document.getElementById("resourceBranch")?.value || "",
    semester: document.getElementById("resourceSemester")?.value || "",
    fileName: document.getElementById("resourceFile").files[0]?.name || "document.pdf",
    uploadedBy: appState.currentUser.name,
    uploadedAt: new Date().toISOString(),
    verified: false,
    downloads: 0,
    upvotes: 0,
  }

  appState.resources.push(formData)
  saveStateToStorage()
  renderResources()
  updateStats()
  awardPoints(10, "Resource uploaded")
  toggleModal("uploadResourceModal")
  e.target.reset()
  console.log("[v0] Resource uploaded:", formData)
}

function handlePostItem(e) {
  e.preventDefault()

  const file = document.getElementById("itemImage")?.files?.[0]
  const base = {
    id: Date.now(),
    title: document.getElementById("itemTitle").value,
    price: document.getElementById("itemPrice").value,
    description: document.getElementById("itemDescription").value,
    contact: document.getElementById("itemContact").value,
    postedBy: appState.currentUser.name,
    postedAt: new Date().toISOString(),
    sold: false,
    image: null,
  }

  if (file) {
    const reader = new FileReader()
    reader.onload = () => {
      base.image = reader.result
      appState.marketplaceItems.push(base)
      saveStateToStorage()
      renderMarketplace()
      awardPoints(5, "Item posted")
      toggleModal("postItemModal")
      e.target.reset()
      console.log("[v0] Marketplace item posted (with image):", base)
    }
    reader.readAsDataURL(file)
  } else {
    appState.marketplaceItems.push(base)
    saveStateToStorage()
    renderMarketplace()
    awardPoints(5, "Item posted")
    toggleModal("postItemModal")
    e.target.reset()
    console.log("[v0] Marketplace item posted:", base)
  }
}

function handlePostLostFound(e) {
  e.preventDefault()

  const formData = {
    id: Date.now(),
    type: document.getElementById("lfType").value,
    itemName: document.getElementById("lfItemName").value,
    description: document.getElementById("lfDescription").value,
    location: document.getElementById("lfLocation").value,
    contact: document.getElementById("lfContact").value,
    postedBy: appState.currentUser.name,
    postedAt: new Date().toISOString(),
  }

  appState.lostFoundItems.push(formData)
  saveStateToStorage()
  renderLostFound()

  // Award points
  awardPoints(5, "Lost/Found item posted")

  // Close modal and reset form
  toggleModal("postLostFoundModal")
  e.target.reset()

  console.log("[v0] Lost/Found item posted:", formData)
}

function handlePostDiscussion(e) {
  e.preventDefault()

  const formData = {
    id: Date.now(),
    title: document.getElementById("discussionTitle").value,
    content: document.getElementById("discussionContent").value,
    category: document.getElementById("discussionCategory").value,
    postedBy: appState.currentUser.name,
    postedAt: new Date().toISOString(),
    upvotes: 0,
    downvotes: 0,
    comments: 0,
  }

  appState.discussions.push(formData)
  saveStateToStorage()
  renderDiscussions()
  updateStats()
  awardPoints(15, "Discussion posted")
  toggleModal("postDiscussionModal")
  e.target.reset()
  console.log("[v0] Discussion posted:", formData)
}

function handleCreateEvent() {
  const title = document.getElementById("evTitle").value
  const date = document.getElementById("evDate").value
  const venue = document.getElementById("evVenue").value
  const description = document.getElementById("evDesc").value
  const form = document.getElementById("evForm").value
  const posterFile = document.getElementById("evPoster")?.files?.[0]

  const baseEvent = {
    id: Date.now(),
    title,
    date,
    venue,
    description,
    form,
    organizer: appState.currentUser?.name || "Organizer",
    closed: false,
    registered: false,
    poster: null,
  }

  if (posterFile) {
    const reader = new FileReader()
    reader.onload = () => {
      baseEvent.poster = reader.result
      appState.events.push(baseEvent)
      saveStateToStorage()
      afterEventCreate()
    }
    reader.readAsDataURL(posterFile)
  } else {
    appState.events.push(baseEvent)
    saveStateToStorage()
    afterEventCreate()
  }

  function afterEventCreate() {
    renderOrganizerEvents()
    updateAdminStats()
    renderEvents()
    document.getElementById("createEventForm").reset()
    const preview = document.getElementById("posterPreview")
    if (preview) preview.innerHTML = ""
    showNotification("Event created")
  }
}

// ===== RENDERING FUNCTIONS =====
function renderResources() {
  const resourcesList = document.getElementById("resourcesList")
  if (!resourcesList) return
  const fb = document.getElementById("filterBranch")?.value || ""
  const fs = document.getElementById("filterSemester")?.value || ""
  let arr = appState.resources || []
  if (fb) arr = arr.filter((r) => (r.branch || "").toLowerCase() === fb.toLowerCase())
  if (fs) arr = arr.filter((r) => (r.semester || "").toLowerCase() === fs.toLowerCase())

  if (arr.length === 0) {
    resourcesList.innerHTML = '<div class="empty-state"><p>No resources yet. Be the first to upload!</p></div>'
    return
  }

  resourcesList.innerHTML = arr
    .map(
      (resource) => `
        <div class="resource-item" data-resource-id="${resource.id}">
          <div class="resource-info">
            <h3>
              ${resource.title}
              ${resource.verified ? '<span class="verified-badge">✓ Verified</span>' : ""}
            </h3>
            <p>${resource.description || "No description"}</p>
            <div class="resource-meta">
              <span>📚 ${resource.subject}</span>
              <span>🏷️ ${resource.branch || "-"} • ${resource.semester || "-"}</span>
              <span>👤 ${resource.uploadedBy}</span>
              <span>📅 ${formatDate(resource.uploadedAt)}</span>
            </div>
          </div>
          <div class="resource-actions">
            <button class="btn btn-secondary btn-small" onclick="upvoteResource(${resource.id})">👍 ${resource.upvotes || 0}</button>
            <button class="btn btn-primary btn-small" onclick="downloadResource(${resource.id})">⬇️ ${resource.downloads || 0}</button>
          </div>
        </div>
      `,
    )
    .join("")
}

function renderMarketplace() {
  const marketplaceGrid = document.getElementById("marketplaceGrid")
  if (!marketplaceGrid) return

  if (appState.marketplaceItems.length === 0) {
    marketplaceGrid.innerHTML = '<div class="empty-state"><p>No items listed yet. Post something to sell!</p></div>'
    return
  }

  marketplaceGrid.innerHTML = appState.marketplaceItems
    .map(
      (item) => `
        <div class="marketplace-item ${item.sold ? "sold" : ""}" data-item-id="${item.id}">
          <div class="item-image">
            ${item.image ? `<img src="${item.image}" alt="Item image" style="width:100%;height:160px;object-fit:cover;border-radius:.5rem"/>` : "🛍️"}
          </div>
          <div class="item-details">
            <h3>${item.title} ${item.sold ? '<span class="verified-badge" style="background:#eaeaea;color:#666">SOLD</span>' : ""}</h3>
            <div class="item-price">₹${item.price}</div>
            <p class="item-description">${item.description || "No description"}</p>
            <p class="item-contact">📞 ${item.contact}</p>
            <p style="font-size:.75rem;color:var(--text-secondary);margin-top:.5rem;">Posted by ${item.postedBy} • ${formatDate(item.postedAt)}</p>
            <div class="btn-group" style="display:flex;gap:.5rem;margin-top:.5rem;">
              <button class="btn btn-secondary btn-small" onclick="openChat(${item.id})">Chat</button>
              <button class="btn btn-secondary btn-small" onclick="toggleSold(${item.id})">${item.sold ? "Mark as Available" : "Mark as Sold"}</button>
            </div>
          </div>
        </div>
      `,
    )
    .join("")
}

function renderEvents() {
  const eventsGrid = document.getElementById("eventsGrid")
  if (!eventsGrid) return
  if (appState.events.length === 0) {
    eventsGrid.innerHTML = '<div class="empty-state"><p>No upcoming events. Check back later!</p></div>'
    return
  }
  eventsGrid.innerHTML = appState.events
    .map((event) => {
      const closed = event.closed === true
      const regSection = closed
        ? '<div class="event-registered" style="background:var(--warning-weak);color:var(--warning-strong)">Registrations Closed</div>'
        : event.registered
          ? `<div class="event-registered">✓ Registered - QR Ticket Available</div>
             <div class="qr-placeholder" style="margin-top:.5rem;padding:.75rem;border:1px dashed var(--border-color);border-radius:.5rem;display:grid;place-items:center;">
               <img src="/qr-code-ticket.jpg" alt="QR ticket placeholder" />
             </div>`
          : `<button class="btn btn-primary btn-block" onclick="registerForEvent(${event.id})">Register Now</button>`
      const poster = event.poster
        ? `<img src="${event.poster}" alt="Event poster" class="event-poster-img"/>`
        : `<div class="event-poster">🎉</div>`
      return `
        <div class="event-card" data-event-id="${event.id}">
          ${poster}
          <div class="event-content">
            <h3>${event.title}</h3>
            <div class="event-meta">
              <span>📅 ${event.date || "-"}</span>
              <span>📍 ${event.venue || "-"}</span>
              <span>👥 ${event.organizer || "-"}</span>
            </div>
            <p class="event-description">${event.description || ""}</p>
            ${regSection}
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

  lostFoundList.innerHTML = arr
    .map(
      (item) => `
        <div class="lost-found-item" data-lf-id="${item.id}">
          <div class="lf-icon">${item.type === "lost" ? "❌" : "✅"}</div>
          <div class="lf-content">
            <span class="lf-type ${item.type}">${item.type.toUpperCase()}</span>
            <h3>${item.itemName}</h3>
            <p>${item.description}</p>
            <div class="lf-meta">
              <span>📍 ${item.location}</span>
              <span>📞 ${item.contact}</span>
              <span>👤 ${item.postedBy}</span>
              <span>📅 ${formatDate(item.postedAt)}</span>
            </div>
          </div>
        </div>
      `,
    )
    .join("")
}

function renderDiscussions() {
  const discussionsList = document.getElementById("discussionsList")
  if (!discussionsList) return
  if (appState.discussions.length === 0) {
    discussionsList.innerHTML = '<div class="empty-state"><p>No discussions yet. Start a conversation!</p></div>'
    return
  }
  discussionsList.innerHTML = appState.discussions
    .map(
      (d) => `
        <div class="discussion-item" data-discussion-id="${d.id}">
          <div class="discussion-header">
            <h3>${d.title}</h3>
            <span class="discussion-category">${d.category}</span>
          </div>
          <p class="discussion-content">${d.content}</p>
          <div class="discussion-footer">
            <span>Posted by ${d.postedBy} • ${formatDate(d.postedAt)}</span>
            <div class="discussion-actions">
              <button class="btn btn-secondary btn-small" onclick="upvoteDiscussion(${d.id})">⬆️ ${d.upvotes || 0}</button>
              <button class="btn btn-secondary btn-small" onclick="downvoteDiscussion(${d.id})">⬇️ ${d.downvotes || 0}</button>
            </div>
          </div>
        </div>
      `,
    )
    .join("")
}

function renderOrganizerEvents() {
  const list = document.getElementById("organizerEventsList")
  if (!list) return

  if ((appState.events || []).length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No events yet. Create one!</p></div>'
    return
  }

  list.innerHTML = appState.events
    .map(
      (e) => `
      <div class="event-card" data-event-id="${e.id}">
        <div class="event-poster">🎉</div>
        <div class="event-content">
          <h3>${e.title}</h3>
          <div class="event-meta"><span>📅 ${e.date || "-"}</span><span>📍 ${e.venue || "-"}</span></div>
          <p class="event-description">${e.description || ""}</p>
          <div class="btn-group" style="display:flex;gap:.5rem;">
            <button class="btn btn-secondary btn-small" onclick="toggleEventClosed(${e.id})">${e.closed ? "Open Reg" : "Close Reg"}</button>
            <button class="btn btn-secondary btn-small" onclick="deleteEvent(${e.id})">Delete</button>
          </div>
        </div>
      </div>`,
    )
    .join("")

  document.getElementById("orgEventCount") &&
    (document.getElementById("orgEventCount").textContent = appState.events.length)
}

function renderAnnouncements() {
  const list = document.getElementById("announcementsList")
  if (!list) return
  const arr = appState.notifications || []
  if (arr.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No announcements yet.</p></div>'
    return
  }
  list.innerHTML = arr
    .map(
      (n) => `
      <div class="discussion-item">
        <div class="discussion-header"><h3>Announcement</h3><span class="discussion-category">club</span></div>
        <p class="discussion-content">${n.text}</p>
        <div class="discussion-footer"><span>By ${n.by} • ${formatDate(n.at)}</span></div>
      </div>`,
    )
    .join("")
}

function renderAdminUsers() {
  const list = document.getElementById("adminUsersList")
  if (!list) return
  const users = appState.users || []
  const q = (document.getElementById("adminUserSearch")?.value || "").toLowerCase().trim()
  const role = (document.getElementById("adminUserRoleFilter")?.value || "").toLowerCase().trim()

  let filtered = users
  if (q) filtered = filtered.filter((u) => u.name.toLowerCase().includes(q) || (u.reg || "").toLowerCase().includes(q))
  if (role) filtered = filtered.filter((u) => (u.role || "").toLowerCase() === role)

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No users match filters.</p></div>'
    return
  }
  list.innerHTML = filtered
    .map(
      (u) => `
      <div class="resource-item">
        <div class="resource-info">
          <h3>${u.name} ${u.banned ? '<span class="verified-badge" style="background:#ffd1d1;color:#b10000">BANNED</span>' : ""}</h3>
          <div class="resource-meta"><span>🧩 ${u.role}</span><span>🆔 ${u.reg}</span></div>
        </div>
        <div class="resource-actions">
          <button class="btn btn-secondary btn-small" onclick="toggleBan(${u.id})">${u.banned ? "Unban" : "Ban"}</button>
          <button class="btn btn-secondary btn-small" onclick="deleteUser(${u.id})">Delete</button>
        </div>
      </div>`,
    )
    .join("")
}

function renderOrganizerRequests() {
  const list = document.getElementById("organizerRequests")
  if (!list) return
  const reqs = appState.organizerRequests || []
  if (reqs.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No pending requests.</p></div>'
    return
  }
  list.innerHTML = reqs
    .map(
      (r) => `
      <div class="resource-item">
        <div class="resource-info">
          <h3>${r.name}</h3>
          <div class="resource-meta"><span>🆔 ${r.by}</span><span>✉️ ${r.email}</span></div>
        </div>
        <div class="resource-actions">
          <button class="btn btn-primary btn-small" onclick="approveOrganizer(${r.id})">Approve</button>
          <button class="btn btn-secondary btn-small" onclick="rejectOrganizer(${r.id})">Reject</button>
        </div>
      </div>`,
    )
    .join("")
}

function renderModeration() {
  const resList = document.getElementById("moderateResources")
  const evList = document.getElementById("moderateEvents")
  if (resList) {
    const arr = appState.resources || []
    resList.innerHTML =
      arr.length === 0
        ? '<div class="empty-state"><p>No resources.</p></div>'
        : arr
            .map(
              (r) => `
          <div class="resource-item">
            <div class="resource-info">
              <h3>${r.title} ${r.verified ? '<span class="verified-badge">✓ Verified</span>' : ""}</h3>
              <div class="resource-meta"><span>📚 ${r.subject}</span><span>🌱 ${r.branch}</span><span>🎓 ${r.semester}</span><span>👤 ${r.uploadedBy}</span></div>
            </div>
            <div class="resource-actions">
              <button class="btn btn-secondary btn-small" onclick="deleteResource(${r.id})">Delete</button>
            </div>
          </div>`,
            )
            .join("")
  }
  if (evList) {
    const arrE = appState.events || []
    evList.innerHTML =
      arrE.length === 0
        ? '<div class="empty-state"><p>No events.</p></div>'
        : arrE
            .map(
              (e) => `
          <div class="event-card">
            <div class="event-content">
              <h3>${e.title}</h3>
              <div class="event-meta"><span>📅 ${e.date || "-"}</span><span>📍 ${e.venue || "-"}</span></div>
              <div class="btn-group" style="display:flex;gap:.5rem;">
                <button class="btn btn-secondary btn-small" onclick="deleteEvent(${e.id})">Delete</button>
              </div>
            </div>
          </div>`,
            )
            .join("")
  }
}

function renderPendingVerification() {
  const pendingList = document.getElementById("pendingVerifyList")
  if (!pendingList) return
  const pending = (appState.resources || []).filter((r) => !r.verified)
  document.getElementById("pendingVerifyCount") &&
    (document.getElementById("pendingVerifyCount").textContent = pending.length)

  if (pending.length === 0) {
    pendingList.innerHTML = '<div class="empty-state"><p>No pending notes to verify.</p></div>'
    return
  }

  pendingList.innerHTML = pending
    .map(
      (r) => `
      <div class="resource-item" data-resource-id="${r.id}">
        <div class="resource-info">
          <h3>${r.title}</h3>
          <p>${r.description || "No description"}</p>
          <div class="resource-meta">
            <span>📚 ${r.subject}</span>
            <span>🌱 ${r.branch}</span>
            <span>🎓 ${r.semester}</span>
            <span>👤 ${r.uploadedBy}</span>
          </div>
        </div>
        <div class="resource-actions">
          <button class="btn btn-primary btn-small" onclick="verifyResource(${r.id})">Verify</button>
          <button class="btn btn-secondary btn-small" onclick="deleteResource(${r.id})">Delete</button>
        </div>
      </div>`,
    )
    .join("")
}

// ===== ACTION FUNCTIONS =====
function downloadResource(resourceId) {
  const resource = appState.resources.find((r) => r.id === resourceId)
  if (resource) {
    resource.downloads = (resource.downloads || 0) + 1
    saveStateToStorage()
    renderResources()
    alert(`Downloading: ${resource.fileName}\n\nIn a real application, this would download the file.`)
    console.log("[v0] Downloading resource:", resource)
  }
}

function registerForEvent(eventId) {
  const event = appState.events.find((e) => e.id === eventId)
  if (event) {
    event.registered = true
    saveStateToStorage()
    renderEvents()
    updateStats()

    // Award points
    awardPoints(20, "Event registered")

    alert(`Successfully registered for: ${event.title}\n\nYour QR ticket is ready!`)
    console.log("[v0] Registered for event:", event)
  }
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

function verifyResource(id) {
  const r = (appState.resources || []).find((x) => x.id === id)
  if (r) {
    r.verified = true
    saveStateToStorage()
    renderResources()
    renderPendingVerification()
    showNotification("Resource verified")
  }
}

function deleteResource(id) {
  appState.resources = (appState.resources || []).filter((x) => x.id !== id)
  saveStateToStorage()
  renderResources()
  renderPendingVerification()
}

function toggleEventClosed(id) {
  const e = (appState.events || []).find((x) => x.id === id)
  if (e) {
    e.closed = !e.closed
    saveStateToStorage()
    renderOrganizerEvents()
    renderEvents()
  }
}

function deleteEvent(id) {
  appState.events = (appState.events || []).filter((x) => x.id !== id)
  saveStateToStorage()
  renderOrganizerEvents()
  renderEvents()
}

function postAnnouncement() {
  const text = document.getElementById("annText").value.trim()
  if (!text) return
  appState.notifications = appState.notifications || []
  appState.notifications.unshift({
    id: Date.now(),
    text,
    by: appState.currentUser?.name || "Organizer",
    at: new Date().toISOString(),
  })
  saveStateToStorage()
  renderAnnouncements()
  document.getElementById("annText").value = ""
  document.getElementById("orgAnnouncementCount") &&
    (document.getElementById("orgAnnouncementCount").textContent = appState.notifications.length)
  showNotification("Announcement posted")
}

function approveOrganizer(id) {
  const r = (appState.organizerRequests || []).find((x) => x.id === id)
  if (!r) return
  appState.users.push({ id: Date.now(), name: r.name, role: "organizer", reg: r.by, banned: false })
  appState.organizerRequests = (appState.organizerRequests || []).filter((x) => x.id !== id)
  saveStateToStorage()
  renderOrganizerRequests()
  renderAdminUsers()
  updateAdminStats()
  showNotification("Organizer approved")
}

function rejectOrganizer(id) {
  appState.organizerRequests = (appState.organizerRequests || []).filter((x) => x.id !== id)
  saveStateToStorage()
  renderOrganizerRequests()
  showNotification("Request rejected")
}

function toggleBan(id) {
  const u = (appState.users || []).find((x) => x.id === id)
  if (u) {
    u.banned = !u.banned
    saveStateToStorage()
    renderAdminUsers()
  }
}

function deleteUser(id) {
  appState.users = (appState.users || []).filter((x) => x.id !== id)
  saveStateToStorage()
  renderAdminUsers()
  updateAdminStats()
}

function upvoteResource(resourceId) {
  const resource = appState.resources.find((r) => r.id === resourceId)
  if (resource) {
    resource.upvotes = (resource.upvotes || 0) + 1
    saveStateToStorage()
    renderResources()
    console.log("[v0] Upvoted resource:", resource)
  }
}

function openChat(itemId) {
  toggleModal("chatModal")
}

function toggleSold(itemId) {
  const item = appState.marketplaceItems.find((i) => i.id === itemId)
  if (item) {
    item.sold = !item.sold
    saveStateToStorage()
    renderMarketplace()
  }
}

function upvoteDiscussion(id) {
  const d = appState.discussions.find((x) => x.id === id)
  if (d) {
    d.upvotes = (d.upvotes || 0) + 1
    saveStateToStorage()
    renderDiscussions()
  }
}

function downvoteDiscussion(id) {
  const d = appState.discussions.find((x) => x.id === id)
  if (d) {
    d.downvotes = (d.downvotes || 0) + 1
    saveStateToStorage()
    renderDiscussions()
  }
}

// ===== GAMIFICATION =====
function awardPoints(points, reason) {
  appState.points += points
  saveStateToStorage()
  updateStats()

  // Show notification
  showNotification(`+${points} points: ${reason}`)

  console.log("[v0] Points awarded:", points, reason)
}

function showNotification(message) {
  const notificationCount = document.getElementById("notificationCount")
  if (notificationCount) {
    const currentCount = Number.parseInt(notificationCount.textContent) || 0
    notificationCount.textContent = currentCount + 1
  }

  // In a real app, this would show a toast notification
  console.log("[v0] Notification:", message)
}

// ===== STATS UPDATE =====
function updateStats() {
  const resourceCount = document.getElementById("resourceCount")
  const eventCount = document.getElementById("eventCount")
  const pointsCount = document.getElementById("pointsCount")
  const postCount = document.getElementById("postCount")
  const totalPoints = document.getElementById("totalPoints")

  if (resourceCount) resourceCount.textContent = appState.resources.length
  if (eventCount) eventCount.textContent = appState.events.filter((e) => e.registered).length
  if (pointsCount) pointsCount.textContent = appState.points
  if (postCount) postCount.textContent = appState.discussions.length
  if (totalPoints) totalPoints.textContent = appState.points
}

function updateAdminStats() {
  const users = appState.users || []
  const events = appState.events || []
  const posts = appState.discussions || []
  document.getElementById("adminUserCount") && (document.getElementById("adminUserCount").textContent = users.length)
  document.getElementById("adminEventCount") && (document.getElementById("adminEventCount").textContent = events.length)
  document.getElementById("adminPostCount") && (document.getElementById("adminPostCount").textContent = posts.length)

  document.getElementById("anResCount") &&
    (document.getElementById("anResCount").textContent = (appState.resources || []).length)
  document.getElementById("anRegCount") &&
    (document.getElementById("anRegCount").textContent = events.filter((e) => e.registered).length)
  document.getElementById("anTopPoints") && (document.getElementById("anTopPoints").textContent = appState.points || 0)

  // draw simple bar chart if canvas present
  const canvas = document.getElementById("adminChart")
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext("2d")
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const metrics = [
      { label: "Resources", value: (appState.resources || []).length, color: "#3b82f6" },
      { label: "Events", value: events.length, color: "#10b981" },
      { label: "Registrations", value: events.filter((e) => e.registered).length, color: "#f59e0b" },
      { label: "Users", value: users.length, color: "#6366f1" },
    ]
    const maxVal = Math.max(1, ...metrics.map((m) => m.value))
    const w = 120,
      gap = 40,
      baseY = 240,
      maxH = 180,
      startX = 60

    metrics.forEach((m, i) => {
      const h = (m.value / maxVal) * maxH
      const x = startX + i * (w + gap)
      ctx.fillStyle = m.color
      ctx.fillRect(x, baseY - h, w, h)
      ctx.fillStyle = "#6b7280"
      ctx.font = "12px sans-serif"
      ctx.fillText(m.label, x, baseY + 16)
      ctx.fillStyle = "#111827"
      ctx.fillText(String(m.value), x + w / 2 - 8, baseY - h - 6)
    })
  }
}

// ===== MODAL FUNCTIONS =====
function toggleModal(modalId) {
  const modal = document.getElementById(modalId)
  if (modal) {
    modal.classList.toggle("active")
  }
}

// Close modal when clicking outside
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal")) {
    e.target.classList.remove("active")
  }
})

// ===== UTILITY FUNCTIONS =====
function formatDate(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString()
}

function logout() {
  if (confirm("Are you sure you want to logout?")) {
    localStorage.removeItem("currentUser")
    localStorage.removeItem("selectedRole")
    window.location.href = "index.html"
  }
}

// ===== LOCAL STORAGE =====
function saveStateToStorage() {
  localStorage.setItem(
    "appState",
    JSON.stringify({
      resources: appState.resources,
      marketplaceItems: appState.marketplaceItems,
      events: appState.events,
      lostFoundItems: appState.lostFoundItems,
      discussions: appState.discussions,
      points: appState.points,
      users: appState.users,
      organizerRequests: appState.organizerRequests,
    }),
  )
}

function loadStateFromStorage() {
  const savedState = localStorage.getItem("appState")
  if (savedState) {
    const parsed = JSON.parse(savedState)
    appState.resources = parsed.resources || []
    appState.marketplaceItems = parsed.marketplaceItems || []
    appState.events = parsed.events || []
    appState.lostFoundItems = parsed.lostFoundItems || []
    appState.discussions = parsed.discussions || []
    appState.points = parsed.points || 0
    appState.users = parsed.users || []
    appState.organizerRequests = parsed.organizerRequests || []
  }
}

function loadAndRenderData() {
  renderResources()
  renderMarketplace()
  renderEvents()
  renderLostFound()
  renderDiscussions()
}

function enhanceDrawerAndProfile() {
  // Change Password -> open Settings
  document.querySelectorAll(".profile-dropdown .dropdown-item").forEach((btn) => {
    const label = (btn.textContent || "").trim().toLowerCase()
    if (label.includes("change password")) {
      btn.addEventListener("click", (e) => {
        e.preventDefault()
        e.stopPropagation()
        navigateToSection("settings")
        document.querySelectorAll(".profile-dropdown").forEach((el) => el.classList.remove("active"))
      })
    }
  })

  // Remove any stray s.png strip in Student
  document.querySelectorAll('img[src*="s.png"]').forEach((el) => el.remove())
}

function roleSpecificCleanup() {
  const page = window.location.pathname.split("/").pop() || ""

  if (page === "teacher-dashboard.html") {
    // Remove Courses links and section
    document.querySelectorAll('[data-section="courses"]').forEach((el) => el.remove())
    document.getElementById("courses")?.remove()
  }

  if (page === "organizer-dashboard.html") {
    // Remove Attendance links and section completely
    document.querySelectorAll('[data-section="attendance"]').forEach((el) => el.remove())
    document.getElementById("attendance")?.remove()
  }
}
