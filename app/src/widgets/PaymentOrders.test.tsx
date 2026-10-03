/**
 * [INPUT]: 依赖 happy-dom、真实订单弹窗与支付 HTTP 替身
 * [OUTPUT]: 包含支付后同单跟踪、待核对和返回窗口刷新回归； 验证前端只显示权威状态、主动查单与管理员日志入口
 * [POS]: 支付 UI 契约回归，不模拟链上或数据库成功
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {afterEach,expect,spyOn,test} from 'bun:test';
import {Window} from 'happy-dom';
const browser=new Window({url:'http://localhost:10000/app/subscription?order=123'});
Object.assign(globalThis,{window:browser,document:browser.document,HTMLElement:browser.HTMLElement,Element:browser.Element,Node:browser.Node,requestAnimationFrame:browser.requestAnimationFrame.bind(browser),cancelAnimationFrame:browser.cancelAnimationFrame.bind(browser)});
const {render,waitFor,cleanup,fireEvent}=await import('@testing-library/react/pure');
const api=await import('../shared/api/payments');
const {PaymentOrders}=await import('./PaymentOrders');
const order={id:'11111111-1111-4111-8111-111111111111',kind:'credits' as const,sku:'credits_500',billing_interval:null,amount_cents:500,status:'pending',checkout_url:null,created_at:'2026-10-03T00:00:00Z',fulfilled_at:null};
const spies:{mockRestore:()=>void}[]=[];
afterEach(()=>{cleanup();spies.splice(0).forEach(x=>x.mockRestore());});
test('URL 回跳不表示成功，等待服务端 refresh 后才展示确认',async()=>{
  spies.push(spyOn(api,'getOrders').mockResolvedValue([order]));
  let complete!:(value:typeof order)=>void;
  const refresh=spyOn(api,'refreshOrder').mockImplementation(()=>new Promise(resolve=>{complete=resolve;}));spies.push(refresh);
  const view=render(<PaymentOrders open onClose={()=>{}}/>);
  await waitFor(()=>expect(view.getByText('等待付款')).toBeTruthy());expect(view.queryByText('付款已确认')).toBeNull();
  complete({...order,status:'paid'});
  await waitFor(()=>expect(view.getByText('付款已确认')).toBeTruthy());expect(refresh).toHaveBeenCalledWith(order.id,false,expect.any(AbortSignal));
});
test('管理员可读取全部事件，包括无关联订单的验签失败',async()=>{
  spies.push(spyOn(api,'getOrders').mockResolvedValue([]));
  const events=spyOn(api,'getOrderEvents').mockResolvedValue([{id:'event',source:'ipn',outcome:'PAYMENT_SIGNATURE_INVALID',provider_status:null,received_at:'2026-10-03T00:00:00Z'}]);spies.push(events);
  const view=render(<PaymentOrders open admin onClose={()=>{}}/>);
  fireEvent.click(view.getByRole('button',{name:'全部 IPN / 对账日志'}));
  await waitFor(()=>expect(view.getByText(/PAYMENT_SIGNATURE_INVALID/)).toBeTruthy());expect(events).toHaveBeenCalledWith(undefined);
});
test('从收银台返回窗口时立即核对指定订单，不等待下一次定时器',async()=>{
  const get=spyOn(api,'getOrder').mockResolvedValue(order);spies.push(get);
  const refresh=spyOn(api,'refreshOrder').mockResolvedValue(order);spies.push(refresh);
  render(<PaymentOrders open orderId={order.id} onClose={()=>{}}/>);
  await waitFor(()=>expect(refresh).toHaveBeenCalledTimes(1));
  browser.dispatchEvent(new browser.Event('focus'));
  await waitFor(()=>expect(refresh).toHaveBeenCalledTimes(2));
  expect(get).toHaveBeenCalledWith(order.id,expect.any(AbortSignal));
});
test('旧固定报价显示重新选购而不继续打开原支付链接',async()=>{
  const legacy={...order,checkout_replacement_required:true,checkout_url:'https://nowpayments.io/payment/?iid=123'};
  spies.push(spyOn(api,'getOrders').mockResolvedValue([legacy]));
  spies.push(spyOn(api,'refreshOrder').mockResolvedValue(legacy));
  let closed=false;
  const view=render(<PaymentOrders open onClose={()=>{closed=true;}}/>);
  await waitFor(()=>expect(view.getByRole('button',{name:'返回选购'})).toBeTruthy());
  expect(view.queryByRole('button',{name:'继续支付'})).toBeNull();
  fireEvent.click(view.getByRole('button',{name:'返回选购'}));expect(closed).toBe(true);
});
