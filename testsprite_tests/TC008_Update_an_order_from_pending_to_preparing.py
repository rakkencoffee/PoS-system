import asyncio
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",         # Set the browser window size
                "--disable-dev-shm-usage",        # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",                     # Use host-level IPC for better stability
                "--single-process"                # Run the browser in a single process mode
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> Navigate to http://localhost:3000
        await page.goto("http://localhost:3000")
        
        # -> Navigate to /kitchen to access the kitchen/barista interface.
        await page.goto("http://localhost:3000/kitchen")
        
        # -> Click the 'Sync Data' button to refresh orders and see if any pending orders appear.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div[2]/div[2]/div/div/div/div[2]/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Navigate to the kiosk homepage so I can create a test order (prerequisite) via the kiosk UI, then return to the kitchen to continue the test.
        await page.goto("http://localhost:3000")
        
        # -> Click the 'Tap to Order' button to start the kiosk ordering flow and create a test order.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div[2]/div[3]/div/div[2]/div[2]/div/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Open a category on the kiosk menu (COFFEE BASED) to add an item to cart and create a test order.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div[2]/div[3]/div/div[2]/div/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Open the first product detail (first product card in Coffee Based) so we can add it to the cart.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div[2]/div[3]/div/div[3]/div/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click 'Add to Cart' for the selected product, then open the Cart so we can place an order from the kiosk.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div[2]/div[3]/div/div[4]/div[2]/div[3]/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div[2]/div[3]/div/header/div/button[2]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Enter a customer name to enable checkout, then place the order (checkout). After that, navigate to /kitchen and continue with verifying the order appears in pending orders.
        frame = context.pages[-1]
        # Input text
        elem = frame.locator('xpath=/html/body/div[2]/div[3]/div/div/div[2]/input').nth(0)
        await asyncio.sleep(3); await elem.fill('Test Customer')
        
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div[2]/div[3]/div/div[2]/div/div[2]/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Navigate to /kitchen and refresh so I can verify the new order appears in pending orders.
        await page.goto("http://localhost:3000/kitchen")
        
        # -> Click the 'Sync Data' button to refresh the kitchen orders and wait for any pending orders to appear.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div[2]/div[2]/div/div/div/div[2]/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Navigate to the kiosk homepage (/) and create a new kiosk order so it appears in the kitchen pending orders.
        await page.goto("http://localhost:3000")
        
        # -> Click 'Tap to Order' on the kiosk homepage to create a new test order (open ordering flow).
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div[2]/div[3]/div/div[2]/div[2]/div/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the 'COFFEE BASED' category on the kiosk menu to open the product list so we can add an item to the cart.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div[2]/div[3]/div/div[2]/div/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Open the first product card in 'Coffee Based' (open product detail modal) so I can add it to cart and place a second test order.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div[2]/div[3]/div/div[3]/div/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Add the displayed product to the cart, then open the Cart so we can proceed to checkout (place the order). After that, we'll navigate to /kitchen and refresh to verify the order appears in pending orders.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div[2]/div[3]/div/div[4]/div[2]/div[3]/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div[2]/div[3]/div/header/div/button[2]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Enter a customer name into the Customer Name field to enable the Checkout button.
        frame = context.pages[-1]
        # Input text
        elem = frame.locator('xpath=/html/body/div[2]/div[3]/div/div/div[2]/input').nth(0)
        await asyncio.sleep(3); await elem.fill('Test Customer')
        
        # -> Click the Checkout button to place the order, then navigate to /kitchen and refresh/wait to locate the pending order so we can open it and start preparing.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div[2]/div[3]/div/div[2]/div/div[2]/button[2]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        await page.goto("http://localhost:3000/kitchen")
        
        # --> Assertions to verify final state
        frame = context.pages[-1]
        assert await frame.locator("xpath=//*[contains(., 'Preparing')]").nth(0).is_visible(), "The order should appear in the preparing queue after starting preparation"
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    