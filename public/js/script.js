document.addEventListener('DOMContentLoaded', function() {
    // Add subtle entrance animation to task cards
    const taskCards = document.querySelectorAll('.task-card');
    taskCards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';

        setTimeout(() => {
            card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 100 * index); // Staggered animation
    });

    // Add loading animation for forms
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function() {
            const submitBtn = this.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.classList.add('loading');
                submitBtn.disabled = true;
            }
        });
    });

    // Create dark mode toggle
    createDarkModeToggle();

    // Create add task quick button
    createAddTaskButton();

    // Add notification system
    setupNotifications();
});

// Create dark mode toggle
function createDarkModeToggle() {
    const toggle = document.createElement('div');
    toggle.className = 'dark-mode-toggle';
    toggle.innerHTML = '🌙';
    toggle.title = 'Змінити тему';

    // Check for saved preference
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        toggle.innerHTML = '☀️';
    }

    toggle.addEventListener('click', function() {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDark);
        this.innerHTML = isDark ? '☀️' : '🌙';
    });

    document.body.appendChild(toggle);
}

// Create add task quick button
function createAddTaskButton() {
    // Only add the button on the dashboard page
    if (!document.querySelector('.add-task')) return;

    const addButton = document.createElement('div');
    addButton.className = 'add-task-button';
    addButton.innerHTML = '+';
    addButton.title = 'Швидко додати завдання';

    addButton.addEventListener('click', function() {
        // Scroll to add task form or focus on title input
        const titleInput = document.querySelector('#title');
        if (titleInput) {
            titleInput.scrollIntoView({ behavior: 'smooth' });
            setTimeout(() => titleInput.focus(), 500);
        }
    });

    document.body.appendChild(addButton);
}

// Setup notification system
function setupNotifications() {
    // Check for success query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const successMessage = urlParams.get('success');

    if (successMessage) {
        showNotification(decodeURIComponent(successMessage));

        // Clean up the URL
        const newUrl = window.location.pathname;
        history.pushState({}, document.title, newUrl);
    }
}

// Show notification function
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;

    document.body.appendChild(notification);

    // Remove after animation completes
    setTimeout(() => {
        document.body.removeChild(notification);
    }, 5000);
}

// Add task priority color visualization
function enhancePriorityVisualization() {
    const prioritySelects = document.querySelectorAll('select[name="priority"]');
    prioritySelects.forEach(select => {
        // Initial color
        updateSelectColor(select);

        // Update on change
        select.addEventListener('change', function() {
            updateSelectColor(this);
        });
    });
}

// Update priority select color based on value
function updateSelectColor(select) {
    const value = select.value;
    select.style.borderLeft = '4px solid';

    if (value === 'Високий') {
        select.style.borderLeftColor = 'var(--priority-high)';
    } else if (value === 'Середній') {
        select.style.borderLeftColor = 'var(--priority-medium)';
    } else {
        select.style.borderLeftColor = 'var(--priority-low)';
    }
}