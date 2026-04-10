import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Make the navbar and footer multi-page friendly first
nav_start = html.find('<nav id="desktop-nav">')
nav_end = html.find('</nav>', html.find('<nav id="hamburger-nav">')) + 6

header_head = html[:nav_start]

# We should replace the exact nav links
def replace_nav_links(text):
    text = text.replace('href="#about"', 'href="about.html"')
    text = text.replace('href="#experience"', 'href="experience.html"')
    text = text.replace('href="#projects"', 'href="projects.html"')
    text = text.replace('href="#contact"', 'href="contact.html"')
    # update logo to link to index
    text = text.replace('class="logo">Illy Hoang</div>', 'class="logo"><a href="index.html" class="logo-link" style="color: inherit; text-decoration: none;">Illy Hoang</a></div>')
    # hamburger links onclick
    text = text.replace('onclick="toggleMenu()">About', '>About')
    text = text.replace('onclick="toggleMenu()">Experience', '>Experience')
    text = text.replace('onclick="toggleMenu()">Projects', '>Projects')
    text = text.replace('onclick="toggleMenu()">Contact', '>Contact')
    return text

header_head = header_head.replace('<body>', '<body class="fade-in">')
header_head = header_head.replace('<title>Portfolio - Illy Hoang</title>', '{TITLE}')

nav_section = html[nav_start:nav_end]
nav_section = replace_nav_links(nav_section)

footer_start = html.find('<footer>')
footer_end = html.find('</footer>') + 9

footer_section = html[footer_start:footer_end]
footer_section = replace_nav_links(footer_section)

scripts = '\n    <script src="script.js"></script>\n  </body>\n</html>\n'

def build_page(title, content, nav_sec=nav_section):
    head = header_head.replace('{TITLE}', title)
    return head + nav_sec + '\n' + content + '\n' + footer_section + scripts

# Extract sections
# Profile
profile_start = html.find('<section id="profile">')
profile_end = html.find('</section>', profile_start) + 10
profile_content = html[profile_start:profile_end]

# Modify onclick for Contact and Experience in Profile
profile_content = profile_content.replace("location.href = './#contact'", "location.href = 'contact.html'")

# About
about_start = html.find('<section id="about">')
about_end = html.find('</section>', about_start) + 10
about_content = html[about_start:about_end]
about_content = about_content.replace("location.href = './#experience'", "location.href = 'experience.html'")

# Experience
exp_start = html.find('<section id="experience">')
exp_end = html.find('</section>', exp_start) + 10
exp_content = html[exp_start:exp_end]
exp_content = exp_content.replace("location.href = './#projects'", "location.href = 'projects.html'")

# Projects
proj_start = html.find('<section id="projects">')
proj_end = html.find('</section>', proj_start) + 10
proj_content = html[proj_start:proj_end]
proj_content = proj_content.replace("location.href = './#contact'", "location.href = 'contact.html'")

# Contact
contact_start = html.find('<section id="contact">')
contact_end = html.find('</section>', contact_start) + 10
contact_content = html[contact_start:contact_end]

# Write files
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(build_page('<title>Portfolio - Illy Hoang</title>', profile_content))

with open('about.html', 'w', encoding='utf-8') as f:
    f.write(build_page('<title>About - Illy Hoang</title>', about_content))

with open('experience.html', 'w', encoding='utf-8') as f:
    f.write(build_page('<title>Experience - Illy Hoang</title>', exp_content))

with open('projects.html', 'w', encoding='utf-8') as f:
    f.write(build_page('<title>Projects - Illy Hoang</title>', proj_content))

with open('contact.html', 'w', encoding='utf-8') as f:
    f.write(build_page('<title>Contact - Illy Hoang</title>', contact_content))

print("Split complete.")
