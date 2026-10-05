# Expense Tracker

A responsive single-page expense tracker built with HTML, CSS, JavaScript, Bootstrap, and Chart.js.

## Features

- Interactive monthly calendar with daily balance totals
- Previous, Current, Next, and year dropdown navigation
- Click any calendar day to add, edit, or delete income and expense entries
- Day-level income, expense, and balance summary in the overlay
- Date is selected from the calendar and cannot be edited manually in the form
- Global totals for income, expenses, and current balance
- Filterable action log by type, category, and search text
- Monthly income, expense, and balance overview
- Category-wise expense chart powered by Chart.js
- Form validation with helpful error messages
- Browser Local Storage persistence
- Responsive desktop and mobile layout

## How to run

1. Open `index.html` in a modern browser.
2. Select a calendar date to open the transaction overlay.
3. Add an income or expense with its amount, category, and description.
4. Refresh the page to confirm data persists in Local Storage.

## Notes

- The app uses CDN-hosted Bootstrap and Chart.js, so an internet connection is needed the first time the page loads.
- All amounts are displayed in Indian Rupees (INR).
- Transaction data is stored locally in the browser under the app's Local Storage keys.