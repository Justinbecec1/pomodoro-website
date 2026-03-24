This is a pomodoro focused timer built app, it allows users to make an account and login based on their credentials, once they log in they can use the timer to set their work and break time, they can also track their progress and see how many pomodoros they have completed. The app also has a feature to see assingment deadlines and any tasks that they have to complete, this is a pomodoro app and a task manager all in one website. 

## Features
- User authentication
- Customizable Pomodoro timer
- Task management
- Progress tracking
- Assignment deadline reminders / email
- Every user has their own data

## Technologies Used
- Frontend: HTML, CSS, Javascript
- Backend: Node.js, Express
- Database: Firebase

## Setup instructions



## Bugs or Limitations

- There are some inconsistencies with the data timer nothing I did fixed it.
- Timer cant be written directly when you click on it
- doesnt send email when assingments are due but sends it for resetting password

## What I learned section

I learned that AI is a very powerfull tool but you still have to know what youre looking at, there where many times throughout the project where I had to review the code and aks copilot to review it as well since it had miscalculated or done something wrong. I also learned that it is a very good teacher after most steps I asked it what it did to learn more about supabase.

## Architecture Overview

Frontend: HTML/CSS/JAVASCRIPT hosted on netifly

Backend: Node.js/Express hosted on Railway

Database: Supabase

## Database Structure

activity_daily:
-user_id
-activity_date
-seconds_spent
-updated_at

profiles:
-id
-email
-display_name
-created_at
-avatar_path

progress_notes
-user_id
-range_key
-content
-created_at
-updated_at