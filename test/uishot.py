import asyncio,sys
from playwright.async_api import async_playwright
W,Hh=(int(sys.argv[1]),int(sys.argv[2])) if len(sys.argv)>2 else (1383,703)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':W,'height':Hh}); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:3123/'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=f'/tmp/ui_title_{W}.png')
        await pg.keyboard.press('ArrowDown'); await pg.wait_for_timeout(100)
        await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300)
        await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('ArrowDown'); await pg.wait_for_timeout(900)
        await pg.screenshot(path=f'/tmp/ui_levels_{W}.png')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(100)
        await pg.click('#bCtl'); await pg.wait_for_timeout(200); await pg.screenshot(path=f'/tmp/ui_controls_{W}.png')
        await pg.keyboard.press('Escape'); await pg.click('#bOpt'); await pg.wait_for_timeout(200); await pg.screenshot(path=f'/tmp/ui_options_{W}.png')
        await pg.keyboard.press('Escape'); await pg.click('#bOnline'); await pg.wait_for_timeout(200); await pg.screenshot(path=f'/tmp/ui_online_{W}.png')
        await pg.fill('#nm','Blaze'); await pg.click('#bCreate'); await pg.wait_for_timeout(800); await pg.screenshot(path=f'/tmp/ui_lobby_{W}.png')
        await pg.click('#bLeave'); await pg.wait_for_timeout(300); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        await pg.evaluate("()=>__hp.startLocal(6)"); await pg.wait_for_timeout(500)
        await pg.keyboard.press('KeyW'); await pg.keyboard.press('ArrowUp'); await pg.wait_for_timeout(300)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300); await pg.screenshot(path=f'/tmp/ui_pause_{W}.png')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        await pg.evaluate("()=>{const g=__hp.game;g.S.dc={1:3,0:1};g.S.deaths=4;g.S.won=true;g.S.winT=1}"); await pg.wait_for_timeout(600)
        await pg.screenshot(path=f'/tmp/ui_win_{W}.png')
        print('errors',errs)
        await b.close()
asyncio.run(main())
