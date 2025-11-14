# TradeLens UX Design Specification

_Created on 2025-01-27 by Andrew_
_Generated using BMad Method - Create UX Design Workflow v1.0_

---

## Executive Summary

TradeLens is a quantitative trading intelligence platform that empowers everyday investors with ML-powered predictions, sentiment analysis, and educational insights. The UX prioritizes efficiency and clarity, enabling users to effortlessly check their portfolio of stocks and access current insights on each stock.

---

## 1. Design System Foundation

### 1.1 Design System Choice

**System:** shadcn/ui
**Version:** Latest (Tailwind-based)
**Rationale:** 
- Already using Tailwind CSS in the project
- Highly customizable to match black background with financial blue/green accents
- Provides solid component defaults while allowing full design control
- Perfect balance for minimalist, data-focused aesthetic
- Components can be styled to create large, prominent data blocks (Fidelity-inspired)

**Components Provided:**
- Form inputs, buttons, cards, tables, modals, dropdowns
- Data display components (badges, tooltips, popovers)
- Navigation components
- Accessible by default with WCAG compliance

**Customization Needs:**
- Custom color theme (black background, financial blue/green accents)
- Large data block styling for portfolio display
- Financial data visualization components
- Custom typography optimized for numerical data

---

## 2. Core User Experience

### 2.1 Defining Experience

**Core User Action:** Check portfolio of stocks and view current insights on each stock

**Critical UX Requirements:**
- Effortless access to full portfolio view
- All data easily accessible (no hidden information)
- Primary focus on portfolio/stocks (main content, not sidebar)
- Quick scanning of stock performance and insights

**Platform:** Web-first responsive design (desktop and mobile)

**Desired Emotional Response:** Efficient and informed

---

## 3. Visual Foundation

### 3.1 Color System

**Base Theme:** Dark Professional with Gold Accents (Hybrid)

**Color Palette:**

**Backgrounds:**
- Primary Background: `#000000` (Pure black - bold, professional)
- Secondary Background: `#0a0a0a` (Slightly lighter for depth)
- Card Background: `#111111` (Enhanced for visibility - pops against black)
- Input Background: `#1a1a1a` (Form elements)

**Primary Colors:**
- Primary: `#1E3A8A` (Financial blue - main actions, key elements)
- Primary Hover: `#1E40AF` (Darker blue on interaction)
- Primary Alpha: `rgba(30, 58, 138, 0.2)` (Focus states, highlights)

**Secondary Colors:**
- Secondary: `#10B981` (Emerald green - supporting actions, positive data)
- Secondary Hover: `#059669` (Darker green on interaction)

**Accent Colors:**
- Gold Accent: `#F59E0B` (Premium highlight - important data, attention)
- Gold Accent Hover: `#D97706` (Darker gold on interaction)
- Gold Alpha: `rgba(245, 158, 11, 0.2)` (Subtle highlights)

**Semantic Colors:**
- Success: `#10B981` (Green - positive indicators, gains)
- Success Alpha: `rgba(16, 185, 129, 0.2)` (Success backgrounds)
- Warning: `#F59E0B` (Gold - attention, medium risk)
- Warning Alpha: `rgba(245, 158, 11, 0.2)` (Warning backgrounds)
- Error: `#EF4444` (Red - errors, negative indicators)
- Error Alpha: `rgba(239, 68, 68, 0.2)` (Error backgrounds)
- Info: `#3B82F6` (Blue - informational messages)

**Neutral Colors:**
- Text Primary: `#FFFFFF` (White - main content)
- Text Secondary: `#9CA3AF` (Muted gray - secondary text)
- Border: `#2a2a2a` (Subtle borders)
- Border Accent: `#3a3a3a` (Card borders - enhanced for visibility)

**Typography:**
- Font Family: System fonts (San Francisco, Segoe UI, Roboto)
- Optimized for numerical data display
- Clear, readable at all sizes
- Monospace option for financial data tables

**Spacing System:**
- Base Unit: 4px
- Scale: 4, 8, 12, 16, 24, 32, 48, 64px
- Card Padding: 16-24px (generous for data blocks)
- Section Spacing: 32-48px

**Card Enhancement:**
- Background: `#111111` (lighter than base for contrast)
- Border: `1px solid #2a2a2a` (subtle definition)
- Border on Hover: `1px solid #3a3a3a` (enhanced visibility)
- Shadow: `0 4px 12px rgba(0, 0, 0, 0.3)` (depth without distraction)
- Shadow on Hover: `0 8px 24px rgba(0, 0, 0, 0.4)` (interactive feedback)
- Border Radius: `8px` (modern, approachable)

**Rationale:**
- **Black Base:** Maintains the bold, professional aesthetic from Dark Professional
- **Gold Accents:** Adds premium feel and draws attention to important data (confidence scores, key metrics)
- **Enhanced Cards:** Lighter background (#111111) creates clear visual separation from black base, making portfolio cards pop while maintaining dark theme cohesion
- **Financial Blue/Green:** Primary actions and positive data remain in professional financial colors
- **High Contrast:** Cards stand out against black background for easy scanning

**Semantic Color Usage:**
- **Primary Blue (#1E3A8A):** Main actions, primary buttons, key navigation
- **Emerald Green (#10B981):** Positive indicators, success states, buy signals
- **Gold (#F59E0B):** Important highlights, confidence scores, premium features, attention
- **Red (#EF4444):** Errors, negative indicators, sell signals, warnings

**Interactive Visualizations:**

- Color Theme Explorer: [ux-color-themes.html](./ux-color-themes.html)

---

## 4. Design Direction

### 4.1 Chosen Design Approach

**Selected Direction:** Sidebar Navigation (Direction 4)

**Layout Pattern:** Two-column layout with left sidebar navigation and main content area

**Key Characteristics:**
- **Layout:** Two-column (sidebar + main content)
- **Density:** Balanced - comfortable spacing without waste
- **Navigation:** Left sidebar with clear active states
- **Focus:** Portfolio centered as main content, not hidden
- **Personality:** Traditional • Desktop-Optimized

**Design Decisions:**

**Navigation Pattern:**
- Left sidebar navigation (250px width)
- Fixed sidebar on desktop, collapses on mobile
- Clear active state indication (background highlight)
- Navigation items: Portfolio, Historical, Profile
- Brand name/logo at top of sidebar

**Content Area:**
- Main content takes remaining space (flex: 1)
- Portfolio cards displayed in responsive grid
- Grid adapts: minmax(300px, 1fr) for flexible columns
- Search bar prominently placed at top of content area
- Page title (e.g., "My Portfolio") above content

**Visual Hierarchy:**
- Sidebar provides structure and context
- Main content area is the focus (portfolio cards)
- Portfolio cards use enhanced styling (#111111 background) to pop against black
- Cards maintain consistent spacing and sizing

**Rationale:**
- **Traditional Pattern:** Familiar sidebar navigation pattern users recognize
- **Desktop-Optimized:** Takes advantage of horizontal space on desktop
- **Portfolio Centered:** Main content (portfolio) is clearly the focus, not hidden
- **Clear Structure:** Sidebar provides persistent navigation context
- **Balanced Density:** Not too sparse, not too dense - comfortable viewing

**Responsive Considerations:**
- Desktop: Sidebar visible, full two-column layout
- Tablet: Sidebar can collapse to icon-only or hamburger menu
- Mobile: Sidebar becomes bottom navigation or drawer menu

**Interactive Mockups:**

- Design Direction Showcase: [ux-design-directions.html](./ux-design-directions.html)

---

## 5. User Journey Flows

### 5.1 Critical User Paths

**Primary Journey: Check Portfolio and View Stock Insights**

**Flow 1: Portfolio Overview → Stock Detail**

**Step 1: Entry - Portfolio Page**
- User lands on Portfolio page (sidebar: Portfolio highlighted as active)
- **Layout:** 2-column grid (2 columns, X rows) displaying all tracked stocks
- Each portfolio card shows:
  - Stock symbol (prominent)
  - Company name
  - Current price change ($ and %)
  - Key metrics: Confidence score, Sentiment, Risk level
- **Search Bar:** Located in main content area (top of portfolio grid)
- **Navigation:** Sidebar provides Portfolio, Historical, Profile links

**Step 2: Click Portfolio Card**
- User clicks any portfolio card
- **Action:** Navigate to dedicated stock detail page (not modal, not inline)
- **URL:** `/portfolio/stock/AAPL` or similar route
- **Transition:** Smooth page navigation, sidebar remains visible

**Step 3: Stock Detail Page**
- **Primary Focus (Top of Page):**
  - **Recommendation:** Large, prominent display of BUY / HOLD / SELL
  - Visual indicator (color, icon, size) making recommendation immediately clear
  - Recommendation is the hero element of the page

- **Secondary Focus (Below Recommendation):**
  - **Why:** Explanation section explaining the recommendation
  - **ML Prediction:** Model output and signal
  - **Sentiment Score:** Current sentiment with context
  - **Confidence Score:** R²-based confidence with explanation
  - **Time Series Chart:** Price history with recommendation timing
  - **Risk Level:** Risk assessment indicator
  - **Historical Context:** Past recommendations for this stock

**Step 4: Navigation Between Sections**
- User clicks sidebar links to navigate:
  - **Portfolio** → Returns to 2-column grid view
  - **Historical** → Shows past recommendations across all stocks
  - **Profile** → User settings and preferences
- **Search:** Always accessible in main content area (top of each page)

**Flow 2: Search for Stock**

**Step 1: Search Entry**
- User types in search bar (main content area, top of page)
- Search bar suggests stocks as user types

**Step 2: Search Results**
- Results displayed in list or grid format
- Each result shows: Symbol, Name, Availability for tracking
- If stock is already tracked: Indicates "In Portfolio"
- If stock not tracked: Shows "Add to Portfolio" option

**Step 3: Select Stock**
- User clicks search result
- Navigates to stock detail page (same as Flow 1, Step 3)
- If not in portfolio: Option to add to tracking list

**Flow 3: Historical Recommendations View**

**Step 1: Navigate to Historical**
- User clicks "Historical" in sidebar
- Page loads showing past recommendations

**Step 2: Historical Display**
- List or timeline view of past recommendations
- Filterable by: Date range, Stock, Signal type (buy/sell/hold)
- Each entry shows: Date, Stock, Recommendation, Outcome (if available)

**Step 3: View Historical Detail**
- User clicks historical entry
- Navigates to stock detail page with historical context highlighted
- Or shows historical recommendation in context

**Decision Points:**
- Which stock to view in detail
- Whether to act on recommendation
- Whether to add new stocks to portfolio (free tier limit)
- Whether to filter historical data

**Error States:**
- Stock not found in search
- Free tier limit reached (can't add more stocks)
- No recommendations available for stock
- Data loading/error states

**Success States:**
- Portfolio cards load successfully
- Stock detail page displays all information
- Search finds desired stock
- Smooth navigation between sections

---

## 6. Component Library

### 6.1 Component Strategy

**Design System:** shadcn/ui (Tailwind-based)

**Components from shadcn/ui:**

**Layout & Navigation:**
- Sidebar component (for left navigation)
- Navigation Menu (for sidebar links with active states)
- Separator (for visual division)

**Cards & Containers:**
- Card component (base for portfolio cards)
- Container/Wrapper components

**Form Components:**
- Input (for search bar)
- Select (for filters)
- Button (primary, secondary actions)

**Data Display:**
- Badge (for confidence, risk, sentiment indicators)
- Table (for historical data if needed)
- Tooltip (for educational explanations)

**Feedback:**
- Alert (for error states, notifications)
- Skeleton (for loading states)

**Custom Components Required:**

**1. Portfolio Card**
- **Purpose:** Display stock information in 2-column grid
- **Anatomy:**
  - Stock symbol (large, prominent)
  - Company name
  - Price change (dollar amount and percentage)
  - Metrics row: Confidence, Sentiment, Risk badges
- **States:** Default, Hover (border highlight), Loading
- **Behavior:** Click navigates to stock detail page
- **Styling:** Enhanced card background (#111111), border, shadow

**2. Stock Detail Header**
- **Purpose:** Primary focus - BUY/HOLD/SELL recommendation
- **Anatomy:**
  - Large recommendation text/icon (hero element)
  - Visual indicator (color: green for buy, yellow for hold, red for sell)
  - Stock symbol and name
- **Variants:** Different sizes/styles for each recommendation type
- **Styling:** Prominent, immediately visible

**3. Recommendation Explanation**
- **Purpose:** Secondary focus - explain why recommendation was made
- **Anatomy:**
  - Explanation text
  - ML Prediction section
  - Sentiment Score with context
  - Confidence Score with explanation
  - Risk Level indicator
- **Layout:** Sections or accordion-style disclosure
- **Styling:** Clear hierarchy, readable

**4. Time Series Chart Container**
- **Purpose:** Display price history with recommendation timing
- **Anatomy:**
  - Chart area (using Recharts or Chart.js)
  - Recommendation markers on timeline
  - Hover tooltips for data points
- **Behavior:** Interactive, zoomable (optional)
- **Styling:** Fits within card/container

**5. Search Results List**
- **Purpose:** Display search results for stocks
- **Anatomy:**
  - Stock symbol and name
  - Status indicator ("In Portfolio" or "Add to Portfolio")
  - Click to navigate or add
- **States:** Default, Hover, Selected
- **Behavior:** Click navigates to detail or adds to portfolio

**Components Requiring Heavy Customization:**

**1. Sidebar Navigation**
- Base: shadcn/ui Sidebar
- Customization: Brand styling, active state highlighting, responsive collapse

**2. Badge Components**
- Base: shadcn/ui Badge
- Customization: Color schemes for confidence (gold), risk (low/medium/high), sentiment (green/red)
- Variants: Size variations for different contexts

**3. Card Component**
- Base: shadcn/ui Card
- Customization: Enhanced styling (#111111 background), hover effects, 2-column grid layout

**Accessibility Requirements:**
- All interactive elements keyboard accessible
- Screen reader labels for financial data
- ARIA roles for navigation and data display
- Focus indicators visible
- Color contrast meets WCAG AA standards

---

## 7. UX Pattern Decisions

### 7.1 Consistency Rules

**Button Hierarchy:**
- **Primary Action:** Financial blue (#1E3A8A) - Main actions (e.g., "Add to Portfolio", "Save Preferences")
- **Secondary Action:** Emerald green (#10B981) - Supporting actions (e.g., "Filter", "Sort")
- **Tertiary Action:** Subtle gray border - Less important actions
- **Destructive Action:** Red (#EF4444) - Delete, remove actions
- **Usage:** One primary action per screen, clear visual hierarchy

**Feedback Patterns:**
- **Success:** Inline message (green text) or subtle toast notification
- **Error:** Inline error message (red text) below affected field or at top of form
- **Warning:** Gold badge/indicator for medium risk, attention needed
- **Info:** Subtle blue text or tooltip for informational messages
- **Loading:** Skeleton loaders for cards, spinner for buttons
- **Rationale:** Keep feedback clear but not intrusive, match financial data context

**Form Patterns:**
- **Label Position:** Above input fields (clear hierarchy)
- **Required Field Indicator:** Asterisk (*) in gold color
- **Validation Timing:** On blur (after user leaves field) - not while typing
- **Error Display:** Inline below field with specific message
- **Help Text:** Tooltip icon next to label for educational content
- **Rationale:** Clean, professional, matches Robinhood simplicity

**Navigation Patterns:**
- **Active State:** Background highlight (#1E3A8A) in sidebar, clear visual indication
- **Hover State:** Subtle background change (#111111 → #1a1a1a)
- **Breadcrumbs:** Not needed (sidebar provides context)
- **Back Button:** Browser back button supported, or "← Back to Portfolio" link on detail pages
- **Deep Linking:** Supported - all pages have unique URLs

**Empty State Patterns:**
- **No Stocks in Portfolio:** "Start by adding stocks to your portfolio" with search prompt
- **No Search Results:** "No stocks found. Try a different search term."
- **No Historical Data:** "No historical recommendations yet. Check back later."
- **Rationale:** Helpful, actionable, not discouraging

**Confirmation Patterns:**
- **Delete/Remove Stock:** Simple confirmation dialog "Remove [STOCK] from portfolio?"
- **Leave Unsaved Changes:** No warning (autosave preferred, or accept data loss)
- **Destructive Actions:** Always confirm before removing stocks from tracking
- **Rationale:** Protect user data, but don't over-confirm

**Notification Patterns:**
- **Placement:** Top-right corner of main content area
- **Duration:** Auto-dismiss after 4 seconds for success, manual dismiss for errors
- **Stacking:** Multiple notifications stack vertically
- **Priority Levels:** Error (red) > Warning (gold) > Info (blue) > Success (green)
- **Rationale:** Non-intrusive, matches sidebar layout

**Search Patterns:**
- **Trigger:** Manual search (user types and presses Enter or clicks search button)
- **Results Display:** Instant as user types (debounced, 300ms delay)
- **Filters:** Search bar in main content, filters below search (if needed)
- **No Results:** Clear message with suggestions
- **Rationale:** Fast, responsive, matches Robinhood simplicity

**Data Display Patterns:**
- **Price Changes:** Green for positive (+), red for negative (-)
- **Confidence Scores:** Gold color (#F59E0B) for all confidence indicators
- **Sentiment:** Green for positive, red for negative
- **Risk Levels:** Badge with color coding (Low: green, Medium: gold, High: red)
- **Number Formatting:** Currency with $, percentages with %, decimals to 2 places
- **Rationale:** Consistent color language, clear visual indicators

**Recommendation Display:**
- **Primary:** Large, prominent BUY/HOLD/SELL indicator (hero element)
- **Colors:** Green for BUY, Gold/Yellow for HOLD, Red for SELL
- **Size:** Recommendation is 2-3x larger than other text on detail page
- **Rationale:** Recommendation is the primary value, make it impossible to miss

---

## 8. Responsive Design & Accessibility

### 8.1 Responsive Strategy

**Platform Priority:** Web-first responsive design (desktop and mobile)

**Breakpoint Strategy:**

**Desktop (≥1024px):**
- **Layout:** Full two-column sidebar layout
- **Grid:** 2-column portfolio grid (as specified)
- **Sidebar:** Fixed 250px width, always visible
- **Navigation:** Full sidebar with text labels
- **Content:** Full width main content area

**Tablet (768px - 1023px):**
- **Layout:** Sidebar collapses to icon-only or hamburger menu
- **Grid:** 2-column portfolio grid (maintains)
- **Sidebar:** Icon-only navigation or slide-out drawer
- **Content:** Full width when sidebar collapsed
- **Touch Targets:** Minimum 44px for touch interactions

**Mobile (<768px):**
- **Layout:** Single column, sidebar becomes bottom navigation or drawer
- **Grid:** 1-column portfolio grid (stacks vertically)
- **Navigation:** Bottom navigation bar or hamburger menu drawer
- **Content:** Full width, stacked layout
- **Touch Targets:** Minimum 44px × 44px
- **Search:** Full width, prominent placement

**Adaptation Patterns:**

**Sidebar Navigation:**
- Desktop: Fixed left sidebar, always visible
- Tablet: Collapsible sidebar (icon-only or drawer)
- Mobile: Bottom navigation or hamburger menu

**Portfolio Grid:**
- Desktop: 2 columns (as specified)
- Tablet: 2 columns (maintains)
- Mobile: 1 column (stacks vertically)

**Cards:**
- Desktop: Full card with all metrics visible
- Tablet: Same card layout, slightly smaller padding
- Mobile: Compact card layout, essential metrics only

**Stock Detail Page:**
- Desktop: Full layout with recommendation hero, all sections visible
- Tablet: Same layout, slightly condensed spacing
- Mobile: Stacked sections, recommendation remains prominent

**Search:**
- Desktop: Search bar in main content area (top)
- Tablet: Same placement, full width
- Mobile: Full width, prominent at top

### 8.2 Accessibility Strategy

**WCAG Compliance Target:** Level AA (recommended standard)

**Key Requirements:**

**Color Contrast:**
- Text on background: Minimum 4.5:1 ratio
- Large text (18pt+): Minimum 3:1 ratio
- Interactive elements: Clearly visible focus states
- Color is not the only indicator (icons, text labels accompany colors)

**Keyboard Navigation:**
- All interactive elements accessible via keyboard
- Tab order follows visual flow
- Focus indicators visible (2px outline, contrasting color)
- Skip navigation link for main content

**Screen Reader Support:**
- ARIA labels for all interactive elements
- Semantic HTML (nav, main, article, section)
- Descriptive alt text for any meaningful images
- Form labels properly associated with inputs
- Status announcements for dynamic content updates

**Focus Management:**
- Visible focus indicators on all interactive elements
- Focus trap in modals/dialogs
- Focus returns to trigger after closing modal
- Focus management for dynamic content

**Form Accessibility:**
- All form fields have associated labels
- Required fields indicated with asterisk and aria-required
- Error messages associated with fields (aria-describedby)
- Clear error identification and instructions

**Data Display Accessibility:**
- Financial data announced clearly to screen readers
- Tables have proper headers (th elements)
- Charts have text alternatives or data tables
- Color coding accompanied by text/icons

**Testing Strategy:**
- Automated: Lighthouse accessibility audit, axe DevTools
- Manual: Keyboard-only navigation testing
- Screen Reader: VoiceOver (macOS), NVDA (Windows) testing
- Color Contrast: WebAIM Contrast Checker

---

## 9. Implementation Guidance

### 9.1 Completion Summary

**✅ UX Design Specification Complete!**

**What we created together:**

- **Design System:** shadcn/ui with 5 custom components and 3 heavily customized components
- **Visual Foundation:** Dark Professional theme with gold accents (#000000 background, #111111 cards, #F59E0B gold highlights)
- **Design Direction:** Sidebar Navigation (Direction 4) - Two-column layout with left sidebar, portfolio-centered main content
- **User Journeys:** 3 critical flows designed with clear navigation paths (Portfolio → Detail, Search, Historical)
- **UX Patterns:** 9 consistency rules established for cohesive experience (buttons, feedback, forms, navigation, etc.)
- **Responsive Strategy:** 3 breakpoints with adaptation patterns for desktop, tablet, and mobile
- **Accessibility:** WCAG AA compliance requirements defined with comprehensive testing strategy

**Your Deliverables:**

- **UX Design Document:** `dist/ux-design-specification.md`
- **Interactive Color Themes:** `dist/ux-color-themes.html`
- **Design Direction Mockups:** `dist/ux-design-directions.html`

**Key Design Decisions:**

1. **Layout:** Sidebar navigation with 2-column portfolio grid (2 columns, X rows)
2. **Navigation:** Click portfolio card → Navigate to dedicated stock detail page
3. **Primary Focus:** BUY/HOLD/SELL recommendation as hero element on detail page
4. **Secondary Focus:** Explanation with ML prediction, sentiment, confidence, chart, risk
5. **Search:** Main content area, always accessible
6. **Cards:** Enhanced styling (#111111 background) to pop against black

**What happens next:**

- **Developers** can implement with clear UX guidance and rationale
- **Designers** can create high-fidelity mockups from this foundation
- **All design decisions** are documented with reasoning for future reference

**Recommended Next Steps:**

- **Next required workflow:** `sprint-planning` (Scrum Master agent) - Create sprint plan with stories
- **Optional:** Run validation with `*validate-design` to check UX specification completeness
- Check workflow status anytime with: `workflow-status`

**You've made thoughtful choices through visual collaboration that will create an efficient and informed user experience. Ready for implementation!**

---

## Appendix

### Related Documents

- Product Requirements: `dist/PRD.md`
- Product Brief: `dist/product-brief-OpenAlpha-2025-10-30.md`

### Core Interactive Deliverables

This UX Design Specification was created through visual collaboration:

- **Color Theme Visualizer**: dist/ux-color-themes.html
  - Interactive HTML showing all color theme options explored
  - Live UI component examples in each theme
  - Side-by-side comparison and semantic color usage

- **Design Direction Mockups**: dist/ux-design-directions.html
  - Interactive HTML with 6-8 complete design approaches
  - Full-screen mockups of key screens
  - Design philosophy and rationale for each direction

---

_This UX Design Specification was created through collaborative design facilitation, not template generation. All decisions were made with user input and are documented with rationale._

