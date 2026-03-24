## Transcript Highlights

### 1. Planning the application (Session, 1 early) 

Before I began writing code I asked copilot to write me a plan for my application and all of its features, the AI mentioned firebase but I wanted to use supabase. Before cloud storage we used localstorage to make sure the logic worked. I asked for a plan so I could see what the AI was thinking and it would be easier to follow and change depending on whats said.

### 2. Solving supabase connection issues (Session 1, end)

I was having issues with connecting the supabase so I used both supabase website for help and Copilots assistance as well, it didn't seem to understand how to use supabase on its own so I had to use my own knowledge. I then had to edit the env file to ensure the information for my database was correct. We still found a solution.

### 3. Debugging timer (Session 2, early)

I had a lot of problems when making the timer section of the application, the first was the UI, I asked claude to move the content of the page to the middle of the page and this was done on all pages. I then had a few errors with the time saving, I had to check supabase tables to make sure their were being inserted correctly, the problem ended up being the table was missing, and load chached data was overiding the new data.
