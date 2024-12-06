document.addEventListener('DOMContentLoaded', () => {
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Contact form submission handler
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Basic form validation
            const name = this.querySelector('input[type="text"]').value;
            const email = this.querySelector('input[type="email"]').value;
            const message = this.querySelector('textarea').value;

            if (name && email && message) {
                // Here you would typically send the form data to a backend service
                // For now, we'll just show an alert
                alert('Thank you for your message, ' + name + '! I will get back to you soon.');
                this.reset(); // Clear the form
            } else {
                alert('Please fill out all fields.');
            }
        });
    }

    // Optional: Add subtle animations or interactions
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) {
        heroContent.style.opacity = 0;
        heroContent.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            heroContent.style.transition = 'all 1s ease';
            heroContent.style.opacity = 1;
            heroContent.style.transform = 'translateY(0)';
        }, 300);
    }
});
