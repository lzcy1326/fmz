/*backtest
start: 2021-07-01 00:00:00
end: 2021-07-22 00:00:00
period: 1m
basePeriod: 1m
*/
//补仓金额比例
const INIT_BUY_PROPORTION = 0.0005;
const FIRST_BUY_PROPORTION = 0.0005;

//初始止盈比例
const INIT_PROFIT_RATIO = 0.004;
//初始触发补仓比例
const INIT_REPLENISHMENT_RATIO = 0.01;
//是否开启动态止盈
const IS_OPEN_PROFIT = false;
//动态止盈触发保证金占比
const JUDGE_DYNAMIC_PROFIT_RATIO = "3,9,18,36";
//动态止盈步进
const PROFIT_STEP = -0.0005;
//是否开启动态补仓
const IS_OPEN_REPLENISHMENT_RATIO = false;
//动态补仓触发的条件---保证金占比%
const JUDGE_DYNAMIC_REPLENISHMENT_RATIO = "3,9,18,36";
//动态补仓步进
const REPLENISHMENT_STEP = 0.01;
//为了保证下单时能吃单，手动加价比例
const ADD_PRICE_PROPORTION = 0.0001;
//开启贪心算法
const OPEN_GREEDY = true;
const GREEDY_INTERVAL_DOWN = 0.1;
const GREEDY_INTERVAL_UP = 0.1;
const GREEDY_BOND = 10;

//开启根据预测加大头仓后降低止盈比例的步进	数
const CROSS_PROFIT_STEP = -0.001;
//显示参数，测试时使用，正式关闭
const SHOW_PARAMETER = false;

//防插针的针大小
const PIN_RATIO = 1;
//开启防单边
const OPEN_UNILATERAL = true;
//插针延迟
const PIN_DELAY = 3;

//根据浮亏止损
const OPEN_POS_PROFIT_LOSS = true;

//账户初始总权益
let totalEq = -1;

//账户当前中权益
let CURR_TOTAL_EQ = totalEq;
//止损保证金阈值
let POS_BOND_LOSS = 0;
//根据浮亏止损阈值
var POS_PROFIT_LOSS = 0;
//根据浮亏金额止损比例
var POS_PROFIT_LOSS_RATIO = 0.12;

//rsi判断是否处于超卖状态
var RSI_SUPER_SELL = false;
//rsi判断是否处于超买状态
var RSI_SUPER_BUY = false;

//均线判断上涨或者下跌  UP/DOWN
var DIRECTION = "";
//	盘口统计深度,按1元为阶梯, 统计合并后的深度数量
var DEPTH_LEVEL = 20;
//观察周期,连续指定周期都满足条件, 就触发交易
var ENTER_PERIOD = 2;
//观察轮询周期(秒),每次观察后暂停的时间
var CALC_INTERVAL = 10;
//	币量倍数,买卖双方币数总和大的一方是另一方的这么多倍时,
var DIFF_RATIO = 1.5;

var b = 0; //开仓
var b1 = 0;  //检测次数
var a = 0; //平仓
var a1 = 0;  //检测次数
//关机
var STOP_ROBOT_STATUS = false;

//止盈后不再下单
var CLOSE_BUY = false;

//开启夜间模式
var NIGTH_MODE = false;
//夜间模式触发保证金，当仓位保证金超过设置值时，停止不再补仓
var NIGTH_MODE_BOND = 10;

//分页
var LIMIT = 500;
//第几页
var OFFSET = 0;
//是否排序
var ORDER_STATUS = false;
//排序条件，保证金
var BOND_VALUE = 0;

//默认k线周期
var PERIOD = PERIOD_M15;
//k线周期单位  0分钟，1小时，2天
var PERIOD_TYPE = 0;
//上一次执行的定时任务分钟
var SCHEDULED_MINUTE = 0;
//上一次执行的定时任务小时
var SCHEDULED_HOUR = 0;

//ema快线周期
var FAST_PERIOD = 5;
//ema慢线周期
var SLOW_PERIOD = 10;
//上涨时观察周期
var MANY_PERIOD = 4;
//下跌时观察周期
var SHORT_PERIOD = 4;
//是否开启锁仓功能
var OPEN_LOCK_POS = false;

function updatePos(ex,ticker) {
    var coin = ex.GetCurrency();
    var pos = _G(coin + "pos");
    if (pos && pos.length > 0) {
        // var ticker = _C(ex.GetTicker);
        for (var i = 0; i < pos.length; i++) {
            if (pos[i].Type == PD_LONG) {
                pos[i].Profit = pos[i].Margin * ((ticker.Last - pos[i].Price) / pos[i].Price) * MARGIN_LEVEL;
            } else {
                pos[i].Profit = pos[i].Margin * ((pos[i].Price - ticker.Last) / pos[i].Price) * MARGIN_LEVEL;
            }
        }
        _G(coin + "pos", pos);
    }
}

// 获取仓位
function getPos(ex, ticker) {
    //传ticker对象才去更新表格
    if (ticker) {
        updatePos(ex,ticker);
    }
    var coin = ex.GetCurrency();
    return _G(coin + "pos");
}

function createPos(price, quantity, type, ex,ticker) {
    var coin = ex.GetCurrency();
    var available_funds = _G("available_funds");
    if (available_funds >= _N(price * quantity / MARGIN_LEVEL, 2)) {
        var pos = getPos(ex, ticker);
        if (pos && pos.length > 0) {
            if (pos.length == 1) {
                if (pos[0].Type == type) {
                    let oldAmount = pos[0].Amount;
                    let oldPrice = pos[0].Price;
                    let oldMargin = pos[0].Margin;

                    pos[0].Amount = oldAmount + quantity;
                    pos[0].Price = _N((oldPrice * oldAmount + price * quantity) / pos[0].Amount, _G(coin + "pricePrecision"));
                    pos[0].Margin = _N(
                            pos[0].Price * pos[0].Amount / MARGIN_LEVEL, 2);
                    if (type == PD_LONG) {
                        pos[0].Profit = pos[0].Margin * ((price - pos[0].Price) / pos[0].Price) * MARGIN_LEVEL;
                    } else {
                        pos[0].Profit = pos[0].Margin * ((pos[0].Price - price) / pos[0].Price) * MARGIN_LEVEL;
                    }
                    _G(coin + "pos", pos);
                } else {
                    var posNew = {
                        'Amount': quantity,       // 持仓量，OKEX合约交易所，表示合约的份数(整数且大于1，即合约张数)
                        'Price': price,     // 持仓均价
                        'Profit': 0,         // 持仓浮动盈亏(数据货币单位：BTC/LTC，传统期货单位:RMB，股票不支持此字段，注:OKEX合约全仓情况下指实现盈余,并非持仓盈亏,逐仓下指持仓盈亏)
                        'Type': type,         // PD_LONG为多头仓位(CTP中用closebuy_today平仓)，PD_SHORT为空头仓位(CTP用closesell_today)平仓，(CTP期货中)PD_LONG_YD为咋日多头仓位(用closebuy平)，PD_SHORT_YD为咋日空头仓位(用closesell平)
                        'Margin': _N(price * quantity / MARGIN_LEVEL, 2)          //仓位占用的保证金
                    };
                    pos.push(posNew);
                    _G(coin + "pos", pos);
                    // occupyMargin = posNew.Margin;
                }
            } else {
                for (var i = 0; i < pos.length; i++) {
                    if (pos[i].Type == type) {
                        let oldAmount = pos[i].Amount;
                        let oldPrice = pos[i].Price;
                        let oldMargin = pos[0].Margin;

                        pos[i].Amount = oldAmount + quantity;
                        pos[i].Price = _N((oldPrice * oldAmount + price * quantity) / pos[i].Amount, _G(coin + "pricePrecision"));
                        pos[i].Margin = _N(pos[i].Price * pos[i].Amount / MARGIN_LEVEL, 2);
                        if (type == PD_LONG) {
                            pos[i].Profit = pos[i].Margin * ((price - pos[i].Price) / pos[i].Price) * MARGIN_LEVEL;
                        } else {
                            pos[i].Profit = pos[i].Margin * ((pos[i].Price - price) / pos[i].Price) * MARGIN_LEVEL;
                        }
                    }
                }
                _G(coin + "pos", pos);
            }
        } else {
            pos = [];
            let posNew = {
                'Amount': quantity,       // 持仓量，OKEX合约交易所，表示合约的份数(整数且大于1，即合约张数)
                'Price': price,     // 持仓均价
                'Profit': 0,         // 持仓浮动盈亏(数据货币单位：BTC/LTC，传统期货单位:RMB，股票不支持此字段，注:OKEX合约全仓情况下指实现盈余,并非持仓盈亏,逐仓下指持仓盈亏)
                'Type': type,         // PD_LONG为多头仓位(CTP中用closebuy_today平仓)，PD_SHORT为空头仓位(CTP用closesell_today)平仓，(CTP期货中)PD_LONG_YD为咋日多头仓位(用closebuy平)，PD_SHORT_YD为咋日空头仓位(用closesell平)
                'Margin': _N(price * quantity / MARGIN_LEVEL, 2)          //仓位占用的保证金
            };
            pos.push(posNew);
            _G(coin + "pos", pos);
        }
        let occupyMargin = price * quantity / MARGIN_LEVEL;
        available_funds = available_funds - occupyMargin;
        _G("available_funds", available_funds);
    } else {
        Log("可用资金不足，下单失败", "#ff0000");
    }
}

function deletePos(type, ex,ticker) {
    var coin = ex.GetCurrency();
    var pos = getPos(ex,ticker);
    if (type == 9) {
        pos = [];
    } else {
        let newPos = [];
        for (let i = 0; i < pos.length; i++) {
            if (pos[i].Type == type) {
                var available_funds = _G("available_funds");
                available_funds = available_funds + pos[i].Margin + pos[i].Profit;
                _G("available_funds", available_funds);
                continue;
            }
            newPos.push(pos[i]);
        }
        pos = newPos;
    }
    _G(coin + "pos", pos);
}

function deletePartPos(type, amount, price, ex, ticker) {
    let coin = ex.GetCurrency();
    let pos = getPos(ex,ticker);
    if (type == 9) {
        pos = [];
    } else {
        let newPos = [];
        for (let i = 0; i < pos.length; i++) {
            if (pos[i].Type == type) {
                let oldAmount = pos[i].Amount;
                let oldPrice = pos[i].Price;
                let oldMargin = pos[i].Margin;
                let oldProfit = pos[i].Profit;
                let available_funds = _G("available_funds");
                if (oldAmount == amount) {
                    available_funds = available_funds + oldMargin + pos[i].Profit;
                } else {
                    //现在的持仓数量
                    let nowAmount = oldAmount - amount;
                    // var nowPrice = (oldAmount * oldPrice - amount * price) / nowAmount;
                    //现在的持仓均价
                    let nowPrice = oldPrice;
                    //现在的保证金
                    let nowMargin = _N(nowAmount * nowPrice / MARGIN_LEVEL, 2);
                    //当前浮亏金额
                    let nowProfit = 0;
                    if (type == PD_LONG) {
                        nowProfit = nowMargin * ((price - nowPrice) / nowPrice) * MARGIN_LEVEL;
                    } else {
                        nowProfit = nowMargin * ((nowPrice - price) / nowPrice) * MARGIN_LEVEL;
                    }
                    available_funds = available_funds + oldMargin - nowMargin + oldProfit - nowProfit;
                    let pos1 = {
                        'Amount': nowAmount,       // 持仓量，OKEX合约交易所，表示合约的份数(整数且大于1，即合约张数)
                        'Price': nowPrice,     // 持仓均价
                        'Profit': nowProfit,         // 持仓浮动盈亏(数据货币单位：BTC/LTC，传统期货单位:RMB，股票不支持此字段，注:OKEX合约全仓情况下指实现盈余,并非持仓盈亏,逐仓下指持仓盈亏)
                        'Type': type,         // PD_LONG为多头仓位(CTP中用closebuy_today平仓)，PD_SHORT为空头仓位(CTP用closesell_today)平仓，(CTP期货中)PD_LONG_YD为咋日多头仓位(用closebuy平)，PD_SHORT_YD为咋日空头仓位(用closesell平)
                        'Margin': nowMargin         //仓位占用的保证金
                    };
                    newPos.push(pos1);

                }
                _G("available_funds", available_funds);
                continue;
            }
            newPos.push(pos[i]);
        }
        pos = newPos;
    }
    _G(coin + "pos", pos);
}

function closePin(ex,coin) {
    let pinManyStatus = _G(coin + "pinManyStatus");
    let pinShortStatus = _G(coin + "pinShortStatus");
    //当rsi平稳之后恢复下单
    checkRsi(ex);
    let rsiSuperPin = _G(coin + "rsiSuperPin");
    //非超卖状态了
    if (rsiSuperPin != 2 && pinManyStatus == 1) {
        Log(coin + "解除预警", "#ff0000");
        _G(coin + "pinManyStatus", 0);
        //记录解除预警的时间戳，当距离解除最近一次预警N分钟后才进行下单
        _G(coin + "pinManyTime",_N(Unix(),0));
        if (OPEN_LOCK_POS) {
            unLockPos(ex,PD_SHORT);
        }
    }
    if (rsiSuperPin != 1 && pinShortStatus == 1) {
        Log(coin + "解除预警", "#ff0000");
        _G(coin + "pinShortStatus", 0);
        //记录解除预警的时间戳，当距离解除最近一次预警N分钟后才进行下单
        _G(coin + "pinShortTime",_N(Unix(),0));
        if (OPEN_LOCK_POS) {
            unLockPos(ex,PD_LONG);
        }
    }
}

//第一种针，一根柱子的涨跌超过指定幅度
function pin1(open,close) {
    return Math.abs(close / open - 1) * 100 >= PIN_RATIO
}

//第二种针，单边长龙,除当前分钟柱子以外连续3根柱子处于超买超卖时，
function pin2(coin,records) {
    //1分钟判断1次单边长龙
    //获取该币种上一次判断长龙的分钟数
    let m = _G(coin + "rsiSuperLongMinute");
    if (!m) {
        m = 0;
    }
    //获取当前分钟数
    let nm = new Date().getMinutes();
    if (m == nm) {
        return 0;
    }
    m = nm;
    _G(coin + "rsiSuperLongMinute",m);
    //如果近3跟柱子的涨幅或者跌幅超过指定的值，则触发防长龙
    //往前第三根柱子
    let k4 = records[records.length - 4];
    //往前第一根柱子
    let k2 = records[records.length - 2];
    //涨跌幅
    if (pin1(k4.Open,k2.Close)) {
        return _G(coin + "rsiSuperLong");
    }  else {
        return 0;
    }
}

function openPin(ex, coin) {
    let pinManyStatus = _G(coin + "pinManyStatus");
    let pinShortStatus = _G(coin + "pinShortStatus");
    //获取当前分钟开盘价，
    let r = _C(ex.GetRecords, PERIOD_M1);
    let k = r[r.length - 1];
    //开盘价格
    let open = k.Open;
    //当前成交价格
    let close = k.Close;
    //当价格涨跌超过指定比例时，停止该方向下单
    if (pin1(open, close)) {
        if (close < open) {
            if (pinManyStatus == 0) {
                Log(coin + "启动防插针预警", "#ff0000");
                _G(coin + "pinManyStatus", 1);
                if (OPEN_LOCK_POS) {
                    lockPos(ex,PD_LONG);
                }
            }
        } else {
            if (pinShortStatus == 0) {
                Log(coin + "启动防插针预警", "#ff0000");
                _G(coin + "pinShortStatus", 1);
                if (OPEN_LOCK_POS) {
                    lockPos(ex,PD_SHORT);
                }
            }
        }
    } else {
        //开启防单边
        if (OPEN_UNILATERAL) {
            let rsiSuperLong = pin2(coin, r);
            if (rsiSuperLong == 1 && pinShortStatus == 0) {
                Log(coin + "启动防单边预警", "#ff0000");
                _G(coin + "pinShortStatus", 1);
                if (OPEN_LOCK_POS) {
                    lockPos(ex,PD_SHORT);
                }
            } else if (rsiSuperLong == 2 && pinManyStatus == 0) {
                Log(coin + "启动防单边预警", "#ff0000");
                _G(coin + "pinManyStatus", 1);
                if (OPEN_LOCK_POS) {
                    lockPos(ex,PD_LONG);
                }
            }
        }
    }
}

//防插针----根据传入的时间来定，目前默认分钟k线数据
function defensePin(ex) {
    var coin = ex.GetCurrency();

    closePin(ex,coin);
    openPin(ex,coin);
}


//锁仓，当触发防单边和插针时，触发反方向锁仓
function lockPos(ex,posDirection) {
    var coin = ex.GetCurrency();
    var lockPosStatus = _G(coin + "lockPosStatus");
    //仓位保证金大于一定金额才去锁仓
    var posBond = 0;
    if (posDirection == PD_LONG) {
        posBond = _G(coin + "manyPosBond");
    } else {
        posBond = _G(coin + "shortPosBond");
    }
    //0为未锁仓
    if (lockPosStatus == 0 && posBond >= 5) {
        var pos = getPos(ex);
        if (pos && pos.length > 0) {
            for (var i = 0;i < pos.length;i++) {
                if (pos[i].Type == posDirection) {
                    // Log("对冲锁仓");
                    var amount = pos[i].Amount;
                    if (posDirection == PD_LONG) {
                        // Log("对冲锁仓,加大空单");
                        //预判要涨，多单停止的同时下与多单相同数量的空单
                        shortBuy(amount, ex)
                    } else {
                        // Log("对冲锁仓,加大多单");
                        manyBuy(amount, ex)
                    }
                    _G(coin + "lockPosStatus",1);
                }
            }
        }
    }
}

//当恢复稳定之后，解除锁仓
function unLockPos(ex,posDirection) {
    var coin = ex.GetCurrency();
    var lockPosStatus = _G(coin + "lockPosStatus");
    if (lockPosStatus == 1) {
        var pos = getPos(ex);
        if (pos && pos.length > 0) {
            for (var i = 0;i < pos.length;i++) {
                if (pos[i].Type == posDirection) {
                    // Log("解除锁仓");
                    if (posDirection == PD_LONG) {
                        // Log("解除锁仓，平多");
                        manySell(1, ex, 1);
                        _G(coin + "lockPosStatus",0);
                    } else {
                        // Log("解除锁仓，平空");
                        shortSell(1, ex, 1);
                        _G(coin + "lockPosStatus",0);
                    }
                }
            }
        }
    }
}

//获取k线交叉
function getCross(ex, pe) {
    let coin = ex.GetCurrency();
    let r = _C(ex.GetRecords, pe);

    //************均线EMA****************
    let emaChart1 = TA.EMA(r, FAST_PERIOD);
    let emaChart2 = TA.EMA(r, SLOW_PERIOD);

    //0处于刚突破未稳定状态，1上涨，2下跌
    let status = _G(coin + "crossStatus");
    //如果近2根k线柱子与趋势相反，或者一正一反，则判断此时为震荡状态
    let r1 = r[r.length - 1];
    let r2 = r[r.length - 2];
    let n = _Cross(emaChart1, emaChart2);
    if (n > 0) {
        //正在上涨
        //观察周期
        if (n - MANY_PERIOD >= 0) {
            if (r1.Close > r1.Open && r2.Close > r2.Open) {
                status = 1;
            }
        } else {
            status = 0;
        }
    } else if (n < 0) {
        //正在下跌
        if (Math.abs(n) - SHORT_PERIOD >= 0) {
            if (r1.Close < r1.Open && r2.Close < r2.Open) {
                status = 2;
            }
        } else {
            status = 0;
        }

    } else {
        status = 0;
    }
    _G(coin + "crossStatus", status);
}

//检测趋势拐点根据1分钟k线
function checkInflectionPoint(ex) {
    let coin = ex.GetCurrency();

    let crossStatus = _G(coin + "crossStatus");
    if (crossStatus != 0) {
        let r = _C(ex.GetRecords, PERIOD_M1);
        //如果近一根柱子与走势相反，则更新为震荡状态
        var r1 = r[r.length - 1];

        if (crossStatus == 1) {
            // TODO
        }
    }
}

//根据选择的k线周期，定时获取k线交叉
function scheduledTaskCross(ex) {
    //当前时间
    let startTime = new Date();
    if (PERIOD_TYPE == 0) {
        //当前分钟
        let m = startTime.getMinutes();
        if (m == 0) {
            getCross(ex, PERIOD);
            SCHEDULED_MINUTE = m;
            return;
        }

        if (m == SCHEDULED_MINUTE) {
            return;
        }
        SCHEDULED_MINUTE = m;
        //k线是多少分钟
        let k = PERIOD / 60;
        if (m == k || m % k == 0) {
            getCross(ex, PERIOD);
        }
    } else if (PERIOD_TYPE == 1) {
        //当前小时
        let h = startTime.getHours();
        if (h == 0) {
            getCross(ex, PERIOD);
            SCHEDULED_HOUR = h;
            return;
        }
        if (h == SCHEDULED_HOUR) {
            return;
        }
        SCHEDULED_HOUR = h;
        //k线是多少小时
        let k = PERIOD / 60 / 60;
        if (h == k || h % k == 0) {
            getCross(ex, PERIOD);
        }
    }
}

//根据1小时k线判断方向
function hourCross(ex) {
    let r = _C(ex.GetRecords, PERIOD_H1);

    let emaChart1 = TA.EMA(r, FAST_PERIOD);
    let emaChart2 = TA.EMA(r, SLOW_PERIOD);

    let n = _Cross(emaChart1, emaChart2);
    //1小时线如果处于震荡那就用4小时线
    if (n == 0) {
        let r4 = _C(ex.GetRecords, PERIOD_H4);
        let emaCharta = TA.EMA(r4, FAST_PERIOD);
        let emaChartb = TA.EMA(r4, SLOW_PERIOD);
        n = _Cross(emaCharta, emaChartb);
    }
    return n;
}

//获取深度挂单总数量
function calcDepth(orders) {
    //卖1价或者买1价
    var base = parseFloat(orders[0].Price);
    var allAmount = 0;
    var n = 0;
    for (var i = 0; i < orders.length && n < DEPTH_LEVEL; i++) {
        //深度价格
        var p = parseFloat(orders[i].Price);
        if (p != base) {
            n++;
            base = p;
        }
        allAmount += orders[i].Amount;
    }
    return allAmount;
}

//价格*数量
function sumDept(orders) {
    //总价值
    var allPrice = 0;
    var allAmount = 0;
    for (var i = 0; i < orders.length && i < DEPTH_LEVEL; i++) {
        //深度价格
        var price = parseFloat(orders[i].Price);
        var amount = orders[i].Amount;
        all += price * amount;
        allAmount += orders[i].Amount;
    }
    if (allAmount == 0) {
        return 0;
    }
    return allPrice / allAmount;
}

//挂单深度
//默认取深度20
//获取这20个深度的平均数
function getDept(ticker, ex) {
    Sleep(5 * DELAY);
    var n = 0;
    while (Math.abs(n) < ENTER_PERIOD) {
        //市场深度
        var depth = _C(ex.GetDepth);
        //如果深度不存在或者卖盘深度小于盘口统计深度 或者买盘深度小于盘口统计深度，继续下次循环
        if (!depth || depth.Asks.length < DEPTH_LEVEL || depth.Bids.length < DEPTH_LEVEL) {
            Sleep(5 * DELAY);
            continue;
        }
        //卖单平均价值
        var asksPrice = sumDept(depth.Asks);
        //卖单平均价值
        var bidsPrice = sumDept(depth.Bids);
        //返回卖单比买单多或者买单比买单多的比例
        var ratio = Math.max(asksPrice / bidsPrice, bidsPrice / asksPrice);
        if (ratio > DIFF_RATIO) {
            if (asksPrice > bidsPrice) {
                //卖单多，要跌
                n = n < 0 ? 0 : n + 1;
            } else {
                //买单多，要涨
                n = n > 0 ? 0 : n - 1;
            }
        } else {
            n = 0;
        }
        Sleep(CALC_INTERVAL * DELAY * 5);
    }
    return n;
}

function getRsi(ex) {
    var records = _C(ex.GetRecords, PERIOD_M1);
    return TA.RSI(records, 6);
}

//根据rsi判断多仓是否可以开
function checkManyRsi(ex) {
    var coin = ex.GetCurrency();
    var rsi6 = getRsi(ex);
    if (rsi6[rsi6.length - 1] <= 30 && rsi6[rsi6.length - 2] <= 30 && rsi6[rsi6.length - 3] <= 30) {
        // Log(rsi6);
        var rsiSuperSell = _G(coin + "rsiSuperSell");
        if (rsiSuperSell == 0) {
            Log(coin + "超卖状态，暂停开多！", "#FF0000");
        }
        _G(coin + "rsiSuperSell", 1);
    } else {
        _G(coin + "rsiSuperSell", 0);
    }
}

//根据rsi判断空仓是否可以开
function checkShortRsi(ex) {
    var coin = ex.GetCurrency();
    var rsi6 = getRsi(ex);
    if (rsi6[rsi6.length - 1] >= 70 && rsi6[rsi6.length - 2] >= 70 && rsi6[rsi6.length - 3] >= 70) {
        // Log(rsi6);
        var rsiSuperBuy = _G(coin + "rsiSuperBuy");
        if (rsiSuperBuy == 0) {
            Log(coin + "超买状态，暂停开空！", "#FF0000");
        }
        _G(coin + "rsiSuperBuy", 1);
    } else {
        _G(coin + "rsiSuperBuy", 0);
    }
}

//判断rsi，
// type 为0是空仓时判断rsi走向
function checkRsi(ex) {
    var coin = ex.GetCurrency();
    var rsi6 = getRsi(ex);
    //当前一分钟k线柱，0震荡1超买2超卖
    var rsiSuperPin = 0;
    if (rsi6[rsi6.length - 1] <= 30) {
        rsiSuperPin = 2;
    } else if (rsi6[rsi6.length - 1] >= 70) {
        rsiSuperPin = 1;
    }
    _G(coin + "rsiSuperPin",rsiSuperPin);
    //预判是否可能处于单边长龙，当前3根柱子rsi一致时
    var rsiSuperLong = 0;
    if (rsi6[rsi6.length - 2] <= 30 && rsi6[rsi6.length - 3] <= 30 && rsi6[rsi6.length - 4] <= 30) {
        rsiSuperLong = 2;
    } else if (rsi6[rsi6.length - 2] >= 70 && rsi6[rsi6.length - 3] >= 70 && rsi6[rsi6.length - 4] >= 70) {
        rsiSuperLong = 1;
    }
    _G(coin + "rsiSuperLong",rsiSuperLong);

    if (rsiSuperLong == 2 && rsiSuperPin == 2) {
        _G(coin + "rsiSuper",2);
    } else if (rsiSuperLong == 1 && rsiSuperPin == 1) {
        _G(coin + "rsiSuper",1);
    } else {
        _G(coin + "rsiSuper",0);
    }
}

//更新程序运行时间
function updateRunTime() {
    var startTime = _G("startTime");
    var nowTime = Unix();
    var runtime = nowTime - startTime;
    var hours = _N(runtime / (3600), 1);
    _G("hours", hours);
}

//斐波那契数列计算，传入仓位，即可返回该仓位需要下单的数量倍数
function fibonacci(n) {
    if (n < 3) {
        return 1;
    }
    var n1 = 1;
    var n2 = 1;
    var sum = 0;
    for (let i = 2; i < n; i++) {
        sum = n1 + n2;
        n1 = n2;
        n2 = sum
    }
    return sum
}

//缓存记录一些数据
function recodeDetail(posDirection, price, ex) {
    let coin = ex.GetCurrency();
    if (posDirection == PD_LONG) {
        let manyStatus = _G(coin + "manyStatus");
        if (!manyStatus || manyStatus == 0) {
            _G(coin + "manyStartTime", _D());
            _G(coin + "manyStartPrice", price);
            _G(coin + "manyStatus", 1);
        }
        _G(coin + "manyEndTime", _D());
        _G(coin + "manyEndPrice", price);

    } else if (posDirection == PD_SHORT) {
        let shortStatus = _G(coin + "shortStatus");
        if (!shortStatus || shortStatus == 0) {
            _G(coin + "shortStartTime", _D());
            _G(coin + "shortStartPrice", price);
            _G(coin + "shortStatus", 1);
        }
        _G(coin + "shortEndTime", _D());
        _G(coin + "shortEndPrice", price);
    }
}

//查询详细交易日志
function getDetailLog(limit, offset, order, bond) {
    let sql = "";
    if (!order) {
        sql = "SELECT * FROM DETAIL_TRANSACTION_RECORD ORDER BY STARTTIME DESC LIMIT " + limit + " OFFSET " + offset + ";";
    } else {
        sql = "SELECT * FROM DETAIL_TRANSACTION_RECORD where BOND >= " + bond + " ORDER BY BOND DESC "
    }
    return DBExec(sql);
}

function getDetailLogAll() {
    let sql = "SELECT * FROM DETAIL_TRANSACTION_RECORD";
    return DBExec(sql);
}

function countDetailLog() {
    let sql = "SELECT COUNT(*) FROM DETAIL_TRANSACTION_RECORD";
    let res = DBExec(sql);
    let count = 0;
    if (res) {
        count = res.values[0];
    }
    return count;
}

function getStatisticLog(coin) {
    let sql = "";
    if (coin) {
        sql = "SELECT * FROM DETAIL_STATISTIC_RECORD WHERE COIN = '" + coin + "';";
    } else {
        sql = "SELECT * FROM DETAIL_STATISTIC_RECORD";
    }
    return DBExec(sql);
}

//插入详细交易日志
function insertDetail(posDirection, avgPrice, lastPrice, bond, profit, ex) {
    let coin = ex.GetCurrency();
    let direction = "";
    let startTime = "";
    let endTime = "";
    let startPrice = 0;
    let endPrice = 0;
    let maxLostProfit = "";

    if (posDirection == PD_LONG) {
        //币种，方向，起始时间，结束时间，起始下单价格，最终下单价格，持仓均价，成交时标记价格，波动率，仓位保证金，收益
        direction = "多";
        startTime = _G(coin + "manyStartTime");
        endTime = _G(coin + "manyEndTime");
        startPrice = _G(coin + "manyStartPrice");
        endPrice = _G(coin + "manyEndPrice");
        maxLostProfit = _G(coin + "maxManyLostProfit") + "%";
    } else if (posDirection == PD_SHORT) {
        direction = "空";
        startTime = _G(coin + "shortStartTime");
        endTime = _G(coin + "shortEndTime");
        startPrice = _G(coin + "shortStartPrice");
        endPrice = _G(coin + "shortEndPrice");
        maxLostProfit = _G(coin + "maxShortLostProfit") + "%";
    }
    var volatility = _N((endPrice - startPrice) / startPrice * 100, 2);
    var sql = "INSERT INTO DETAIL_TRANSACTION_RECORD "
            + "(COIN,DIRECTION,STARTTIME,ENDTIME,STARTPRICE,ENDPRICE,AVERAGEPRICE,CLOSEPOSPRICE,MAXSHORTLOSTPROFIT,VOLATILITY,BOND,PROFIT) "
            + "VALUES ('" + coin + "','" + direction + "','" + startTime
            + "','" + endTime + "'," + startPrice + ","
            + endPrice + "," + avgPrice
            + "," + lastPrice + ",'" + maxLostProfit + "','"
            + volatility + "%',"
            + _N(bond, 2) + "," + _N(profit, 2) + ");";
    DBExec(sql);

    //查询该币种统计信息
    //只有一条记录
    var res = getStatisticLog(coin);
    var newProfit =  res.values[0][1] + profit;
    var newServicecharge = _G(coin + "charge");
    //计算当前收益/亏损属于哪个档位
    var section = 0;
    for (var i = 0;i < 30;i++) {
        var n = i*INIT_REPLENISHMENT_RATIO*100;
        if (Math.abs(volatility) <= n) {
            section = i;
            break;
        }
    }
    var v = "VOLATILITY" + section;
    var volatilitySection = res.values[0][section+3];
    if (volatilitySection) {
        var arr = volatilitySection.split("|");
        var count = parseInt(arr[0])  + 1;
        var pro = _N(parseFloat(arr[1]) + profit,2);
        volatilitySection = count + "|" + pro;
    } else {
        volatilitySection = 1 + "|" + _N(profit,2);
    }
    var updateStatisticSql = "UPDATE DETAIL_STATISTIC_RECORD SET PROFIT = " + _N(newProfit,2)
            + ",SERVICECHARGE = " + _N(newServicecharge,2)
            + "," + v + " = '" + volatilitySection
            + "' WHERE COIN = '" + coin + "'";
    DBExec(updateStatisticSql);
}


// 币安期货
function getTotalEquity_Binance() {
    var totalEquity = null;
    var ret = _C(exchanges[0].GetAccount);
    if (ret) {
        try {
            totalEquity = parseFloat(ret.Info.totalWalletBalance)
        } catch (e) {
            Log("获取账户总权益失败！");
            return null
        }
    }
    return totalEquity
}

function getHuicheEquity() {
    //获取余额
    var ret = exchanges[0].GetAccount();
    return ret.Balance;
}

function getTotalEquity() {
    let exName = exchanges[0].GetName();
    let eq = 0;
    if (IS_HUICHE) {
        eq = getHuicheEquity();
    } else if (IS_OPEN_SIMULATED_FUNDS) {
        eq = _G("simulatedEq");
    } else {
        if (exName == "Futures_Binance") {
            var e = getTotalEquity_Binance();
            var usdtTransfer = _G("usdtTransfer");
            eq = e + usdtTransfer;
        } else {
            throw "不支持该交易所"
        }
    }

    CURR_TOTAL_EQ = eq;
    //总盈利
    _G("totalProfit", eq - totalEq);
    return eq;

}

//统计收益
function statisticEq() {
    //记录该次收益，增加次数
    var currTotalEq = getTotalEquity();
    if (currTotalEq < 0) {
        Log("爆仓", "#ff0000");
        throw "爆仓---大侠请重新来过"
    }
    if (currTotalEq) {
        LogProfit(currTotalEq - totalEq, "当前总权益：", currTotalEq);
        Log("当前总权益：", currTotalEq);
        //复利模式下更新根据保证金止损的阈值
        if (COMPOUND_INTEREST) {
            POS_BOND_LOSS = currTotalEq * POS_BOND_LOSS_RATIO;
            POS_PROFIT_LOSS = currTotalEq * POS_PROFIT_LOSS_RATIO;
        }
        return currTotalEq;
    }

}

function cancelAll(ex) {
    while (1) {
        var orders = _C(ex.GetOrders);
        if (orders.length == 0) {
            break
        }
        for (var i = 0; i < orders.length; i++) {
            ex.CancelOrder(orders[i].Id, orders[i]);
            Sleep(DELAY)
        }
        Sleep(DELAY)
    }
}

//更新浮动盈亏
function updateProfit(ex,ticker) {
    var coin = ex.GetCurrency();
    var pos = getPos(ex,ticker);
    if (!pos || pos.length == 0) {
        _G(coin + "manyProfit", 0);
        _G(coin + "shortProfit", 0);
        return;
    }
    for (var i = 0; i < pos.length; i++) {
        var bond = pos[i].Margin;
        var profit = pos[i].Profit;
        var price = pos[i].Price;
        var amount = pos[i].Amount;
        if (pos[i].Type == PD_LONG) {
            _G(coin + "manyPosBond", bond);
            if (COMPOUND_INTEREST) {
                _G(coin + "manyPosBondRatio", _N(bond / CURR_TOTAL_EQ * 100, 2))
            } else {
                _G(coin + "manyPosBondRatio", _N(bond / totalEq * 100, 2));
            }
            var manyProfit = _N(profit / bond * 100, 2);
            _G(coin + "manyProfit", manyProfit);
            var maxManyLostProfit = _G(coin + "maxManyLostProfit");
            if (manyProfit < 0 && Math.abs(manyProfit) > Math.abs(
                    maxManyLostProfit)) {
                _G(coin + "maxManyLostProfit", manyProfit);
            }
            _G(coin + "manyPrice", price);
            _G(coin + "manyPosNum", amount);

        } else {
            _G(coin + "shortPosBond", bond);
            if (COMPOUND_INTEREST) {
                _G(coin + "shortPosBondRatio",
                        _N(bond / CURR_TOTAL_EQ * 100, 2));
            } else {
                _G(coin + "shortPosBondRatio", _N(bond / totalEq * 100, 2));
            }
            var shortProfit = _N(profit / bond * 100, 2);
            _G(coin + "shortProfit", shortProfit);
            var maxShortLostProfit = _G(coin + "maxShortLostProfit");

            if (shortProfit < 0 && Math.abs(shortProfit) > Math.abs(
                    maxShortLostProfit)) {
                _G(coin + "maxShortLostProfit", shortProfit);
            }

            _G(coin + "shortPrice", price);
            _G(coin + "shortPosNum", amount);
        }
    }
}

//分组
function groupBy(array, f) {
    let groups = {};
    array.forEach(function (o) {
        let group = JSON.stringify(f(o));
        groups[group] = groups[group] || [];
        groups[group].push(o);
    });
    return Object.keys(groups).map(function (group) {
        return groups[group];
    });
}

//更新表格
function updateTable() {
    var startTime = _G("startTime");
    var startTimeFormat = _D(startTime*1000);
    var runTime = _G("hours");
    var initEq = totalEq;
    var nowEq = getTotalEquity();
    var available_funds = _N(_G("available_funds"), 2);
    var eq = _G("totalProfit");
    var dayEq = '--';
    var monthEq = '--';
    var yearEq = '--';
    if (runTime > 24) {
        dayEq = _N((eq / initEq * 100) / (runTime / 24), 2);
        monthEq = _N(dayEq * 30, 2);
        yearEq = _N(dayEq * 365, 2);
    }
    var usdtTransfer = _G("usdtTransfer");
    if (!usdtTransfer) {
        usdtTransfer = 0;
        _G("usdtTransfer",0);
    }
    var loopDelay = _G("loopDelay");
    var table1 = {
        type: 'table',
        title: '用户收益',
        cols: ['开始时间', '运行时间', '初始投资额', '当前余额', '可用保证金','自动划转金额', '当前收益', '预估日化(约)',
            '预估月化(约)', '预估年化(约)', '操作','延迟'],
        rows: [
            [startTimeFormat, runTime, _N(initEq, 2), _N(nowEq, 2), available_funds,usdtTransfer,
                _N(eq, 2) + "|" + _N(eq / initEq * 100, 2) + "%", dayEq + "%",
                monthEq + "%", yearEq + "%",
                {'type': 'button', 'cmd': 'sellAll', 'name': '一键平仓'},loopDelay]
        ]
    };

    var table2Arr = new Array();

    //由于目前出现了模拟资金下，可用保证金统计错误的情况，故在此重新计算可用资金
    var allMargin = 0;
    for (var j = 0; j < exchanges.length; j++) {
        var currCoin = exchanges[j].GetCurrency();
        var bondMany = 0;
        var priceMany = 0;
        var nowPriceMany = 0;
        var profitMany = 0;
        var profitManyRatio = '';

        var bondShort = 0;
        var priceShort = 0;
        var nowPriceShort = 0;
        var profitShort = 0;
        var profitShortRatio = '';

        var pos = [];
        if (IS_OPEN_SIMULATED_FUNDS) {
            pos = getPos(exchanges[j]);
        } else {
            //实盘时每次更新表格的时候去同步真实仓位，
            pos = _C(exchanges[j].GetPosition);
            _G(currCoin + "pos",pos);
        }

        //这里花时间去更新最新标记价格我觉得也是浪费时间，直接取上一次币种的就行
        var tickerLast = _G(currCoin + "tickerLast");
        // var ticker = _C(exchanges[j].GetTicker);
        if (pos) {

            for (var i = 0; i < pos.length; i++) {
                if (pos[i].Type == PD_LONG) {
                    bondMany = pos[i].Margin;
                    priceMany = pos[i].Price;
                    nowPriceMany = tickerLast;
                    profitMany = pos[i].Profit;
                    // MANY_PROFIT = _N((nowPriceMany-priceMany)/priceMany*100*MARGIN_LEVEL,2);
                    profitManyRatio = _N(profitMany / bondMany * 100, 2) + '%';
                } else if (pos[i].Type == PD_SHORT) {
                    bondShort = pos[i].Margin;
                    priceShort = pos[i].Price;
                    nowPriceShort = tickerLast;
                    profitShort = pos[i].Profit;
                    // SHORT_PROFIT = _N((priceShort-nowPriceShort)/priceShort*100*MARGIN_LEVEL,2);
                    profitShortRatio = _N(profitShort / bondShort * 100, 2) + '%';
                }

                allMargin = allMargin + pos[i].Margin;
            }
        }
        var manyStopBuy = _G(currCoin + "manyStopBuy");
        var manyDesStr = "";
        manyStopBuy == 1?manyDesStr = "禁止自动开多 #ff0000":manyDesStr = "允许自动开多 #00ff00";
        var arr1 = [currCoin, '多', _N(bondMany, 2), priceMany, nowPriceMany,
            _N(profitMany, 2),manyDesStr,{'type': 'button', "class": "btn btn-xs btn-warning",'cmd': currCoin+'manyStopBuy', 'name': '停止开多'},
            {'type': 'button', "class": "btn btn-xs btn-success",'cmd': currCoin+'manyStartBuy', 'name': '恢复开多'},
            {'type': 'button', "class": "btn btn-xs btn-danger",'cmd': currCoin+'manySellHalf', 'name': '平一半多仓'},
            {'type': 'button', "class": "btn btn-xs btn-danger",'cmd': currCoin+'manySellAll', 'name': '平全部多仓'}];
        var shortStopBuy = _G(currCoin + "shortStopBuy");
        var shortDesStr = "";
        shortStopBuy == 1?shortDesStr = "禁止自动开空 #ff0000":shortDesStr = "允许自动开空 #00ff00";
        var arr2 = [currCoin, '空', _N(bondShort, 2), priceShort, nowPriceShort,
            _N(profitShort, 2),shortDesStr,{'type': 'button', "class": "btn btn-xs btn-warning",'cmd': currCoin+'shortStopBuy', 'name': '停止开空'},
            {'type': 'button', "class": "btn btn-xs btn-success",'cmd': currCoin+'shortStartBuy', 'name': '恢复开空'},
            {'type': 'button', "class": "btn btn-xs btn-danger",'cmd': currCoin+'shortSellHalf', 'name': '平一半空仓'},
            {'type': 'button', "class": "btn btn-xs btn-danger",'cmd': currCoin+'shortSellAll', 'name': '平全部空仓'}];
        table2Arr.push(arr1);
        table2Arr.push(arr2);
    }

    if (IS_OPEN_SIMULATED_FUNDS) {
        var available_funds_new = nowEq - allMargin;
        _G("available_funds",available_funds_new);
    }

    var table2 = {
        type: 'table',
        title: '持仓信息',
        cols: ['币种', '方向', '仓位保证金', '持仓均价', '当前标记价格', '浮盈/亏','当前状态','操作1','操作2','操作3','操作4'],
        rows: table2Arr
    };

    var table98 = {
        type: 'table',
        title: '策略介绍',
        cols: ['策略介绍'],
        rows: [['本策略基于马丁，辅以自适应止盈、补仓和防插针功能，集成多种下单模式，再加上多级风控，盈利能力可观，爆仓风险极低！'],
            ['策略自带模拟资金功能，经过大量实盘对比，模拟资金收益比实盘多5%左右，较为可信！'],
            ['感兴趣的朋友可以前来试用5天，试用期间建议多使用模拟资金，验证本策略在各个币种各个参数下真实行情中表现如何！']]
    };

    var table99 = {
        type: 'table',
        title: '联系方式',
        cols: ['wx'],
        rows: [['Toy2041']]
    };
    var tableDes = [table98,table99];


    var table10 = {};
    var table11 = {};
    if (SHOW_PARAMETER) {
        table10 = {
            type: 'table',
            title: '初级参数信息',
            cols: ['参数名', '参数值'],
            rows:handleParameter1()
        };
        table11 = {
            type: 'table',
            title: '进阶参数信息',
            cols: ['参数名', '参数值'],
            rows:handleParameter2()
        };
    }

    if (!IS_HUICHE) {
        var vet = getDetailLog(LIMIT, OFFSET, ORDER_STATUS, BOND_VALUE);
        let coinArry = groupBy(vet.values, function (item) {
            return [item[0]];
        });

        let tables = [];
        // let table3Arr = [];
        coinArry.forEach(function (coin) {
            let count = coin.length;
            let table = {
                type: 'table',
                title: coin[0][0] + '_详细成交信息，共(' + count + ')条',
                cols: ['币种', '方向', '起始下单时间', '最终下单时间', '起始下单价格', '最终下单价格',
                    '持仓均价',
                    '成交时标记价格',
                    '最大浮亏', '波动率%', '仓位保证金', '收益'],
                rows: coin
            };
            tables.push(table);

        });

        //根据初始补仓比例，计算列头cols，当初始补仓比例为0.01时，每波动1%为一个档次，默认上限15
        //当开启动态补仓时，则上限变为30
        var table4Col = handleStatisticCol();
        var table4Rows = getStatisticLog().values;
        var table4 = {
            type: 'table',
            title: '币种统计(次数|收益)',
            cols: table4Col,
            rows:table4Rows
        };
        let tableAll = [table1, table2,table4];
        if (SHOW_PARAMETER) {
            tableAll.push(table10);
            tableAll.push(table11);

        } else {
        }
        LogStatus('`' + JSON.stringify(tableDes) + '`\n' + '`' + JSON.stringify(tableAll)+ '`\n' + '`' + JSON.stringify(tables) + '`');
    } else {
        let tableAll = [table1, table2];
        if (SHOW_PARAMETER) {
            tableAll.push(table10);
            tableAll.push(table11);
        }
        LogStatus('`' + JSON.stringify(tableDes) + '`\n' + '`' + JSON.stringify(tableAll) + '`')
    }
}

function handleStatisticCol() {
    var len = 15;
    if (IS_OPEN_REPLENISHMENT_RATIO) {
        len = 20;
    }
    var col = ['币种', '总收益', '手续费'];
    for (var i = 0;i < len;i++) {
        col.push(_N(i*INIT_REPLENISHMENT_RATIO*100,2)+'%')
    }
    return col;

}

function handleParameter1() {
    var tableArr = [];
    tableArr.push(['重置数据',IS_RESET]);
    tableArr.push(['是不是回测盘',IS_HUICHE]);
    tableArr.push(['杠杆倍数',MARGIN_LEVEL]);
    tableArr.push(['主动延迟',DELAY]);
    tableArr.push(['初始触发止盈比例',INIT_PROFIT_RATIO]);
    tableArr.push(['初始触发补仓比例',INIT_REPLENISHMENT_RATIO]);
    tableArr.push(['补仓时单笔下单金额占总金额的比例',INIT_BUY_PROPORTION]);
    tableArr.push(['是否开启复利',COMPOUND_INTEREST]);
    tableArr.push(['是否开启模拟资金',IS_OPEN_SIMULATED_FUNDS]);
    if (IS_OPEN_SIMULATED_FUNDS) {
        tableArr.push(['模拟资金初始资金',INIT_SIMULATED_FUNDS]);
        tableArr.push(['模拟资金单边手续费',SERVICE_CHARGE_RATIO]);
    }
    tableArr.push(['默认止损方式，止损比例---相对于总仓位',STOP_LOSS_RELATIVE_ALL_POS]);
    tableArr.push(['止损比例---亏损多少触发止损',STOP_LOSS_RATIO]);
    tableArr.push(['开启根据保证金止损',OPEN_POS_BOND_LOSS]);
    if (OPEN_POS_BOND_LOSS) {
        tableArr.push(['止损保证金阈值比例',POS_BOND_LOSS_RATIO]);
    }
    tableArr.push(['是否开启部分止损',IS_OPEN_PART_LOSS]);
    if (IS_OPEN_PART_LOSS) {
        tableArr.push(['触发部分止损时，平部分单比例',PART_LOSS_RATIO]);
    }
    return tableArr;
}

function handleParameter2() {
    var tableArr = [];
    tableArr.push(['是否开启动态止盈',IS_OPEN_PROFIT]);
    if (IS_OPEN_PROFIT) {
        tableArr.push(['动态止盈触发的条件',JUDGE_DYNAMIC_PROFIT_RATIO]);
        tableArr.push(['动态止盈步进',PROFIT_STEP]);
    }
    tableArr.push(['是否开启动态补仓',IS_OPEN_REPLENISHMENT_RATIO]);
    if (IS_OPEN_REPLENISHMENT_RATIO) {
        tableArr.push(['动态补仓触发的条件',JUDGE_DYNAMIC_REPLENISHMENT_RATIO]);
        tableArr.push(['动态补仓步进',REPLENISHMENT_STEP]);
    }
    tableArr.push(['为了保证下单时能吃单，手动加价比例',ADD_PRICE_PROPORTION]);
    tableArr.push(['是否开启均线趋势加大头仓功能',OPEN_CROSS_POS_ADD]);
    if (OPEN_CROSS_POS_ADD) {
        tableArr.push(['头仓下单金额占总金额的比例',FIRST_BUY_PROPORTION]);
        tableArr.push(['开启均线趋势加大头仓后降低止盈比例的步进 数',CROSS_PROFIT_STEP]);
        var str = "";
        if (K_LINE_PERIOD == 0) {
            str = "1分钟";
        } else if (K_LINE_PERIOD == 1) {
            str = "5分钟";
        } else if (K_LINE_PERIOD == 2) {
            str = "15分钟";
        } else if (K_LINE_PERIOD == 3) {
            str = "30分钟";
        } else if (K_LINE_PERIOD == 4) {
            str = "1小时";
        }
        tableArr.push(['K线周期',str]);
    }

    tableArr.push(['开启贪心算法',OPEN_GREEDY]);
    if (OPEN_GREEDY) {
        tableArr.push(['贪心间隔（下限）',GREEDY_INTERVAL_DOWN]);
        tableArr.push(['贪心间隔（上浮）',GREEDY_INTERVAL_UP]);
        tableArr.push(['触发贪心时的保证金',GREEDY_BOND]);
    }


    tableArr.push(['开启自动将合约盈利金额划转至现货账户',OPRN_FUTURES_TRANSFER]);
    if (OPRN_FUTURES_TRANSFER) {
        tableArr.push(['划转阈值',FUTURES_TRANSFER_THRESHOLD]);
    }

    tableArr.push(['开启防插针系统',OPEN_DEF_PIN]);
    if (OPEN_DEF_PIN) {
        tableArr.push(['防插针的针大小',PIN_RATIO]);
        tableArr.push(['开启防单边',OPEN_UNILATERAL]);
        tableArr.push(['解除防插针/单边后多少分钟才恢复该方向下单',PIN_DELAY])
    }
    tableArr.push(['是否开启扛单',CARRY_BILL]);
    tableArr.push(['显示参数',SHOW_PARAMETER]);
    tableArr.push(['保证金预警值',BOND_ALARM]);
    return tableArr;
}

//获取当前币种最小下单数量
function getMinQuantity(ex) {

    var minQuantity = 0;
    var currCoin = ex.GetCurrency();
    var currCoinMinQuantity = _G(currCoin);
    if (currCoinMinQuantity) {
        minQuantity = currCoinMinQuantity;
    } else {
        if (IS_HUICHE) {
            if (currCoin == "BTC_USDT") {
                minQuantity = 0.001;
            } else if (currCoin == "LTC_USDT") {
                minQuantity = 0.001;
            } else if (currCoin == "ETH_USDT") {
                minQuantity = 0.001;
            } else if (currCoin == "ETC_USDT") {
                minQuantity = 0.01;
            } else if (currCoin == "BCH_USDT") {
                minQuantity = 0.001;
            } else if (currCoin == "EOS_USDT") {
                minQuantity = 0.1;
            }
        } else {
            //币安
            while (true) {
                var ret = ex.IO("api", "GET", "/fapi/v1/exchangeInfo");
                if (!ret) {
                    continue;
                }
                var aa = ret.symbols;
                for (var i = 0; i < aa.length; i++) {
                    if (aa[i].symbol == currCoin.replace("_", "")) {
                        minQuantity = aa[i].filters[1].minQty;
                    }
                }
                _G(currCoin, minQuantity);
                break
            }
        }
    }
    return minQuantity;
}

//获取下单精度
function updatePricePrecision(ex) {
    var coin = ex.GetCurrency();
    var ticker = _C(ex.GetTicker);
    var price1 = (ticker.Last).toString();
    var price1Precision = 0;
    if (price1.indexOf(".") != -1) {
        let c = price1.split(".");
        price1Precision = c[1].length;
    }
    var price2 = (ticker.Sell).toString();
    var price2Precision = 0;
    if (price2.indexOf(".") != -1) {
        let c = price2.split(".");
        price2Precision = c[1].length;
    }
    var price3 = (ticker.Buy).toString();
    var price3Precision = 0
    if (price3.indexOf(".") != -1) {
        let c = price3.split(".");
        price3Precision = c[1].length;
    }
    var pricePrecision = price1Precision;
    if (price1Precision <= price2Precision) {
        pricePrecision = price2Precision;
    }
    if (price2Precision <= price3Precision) {
        pricePrecision = price3Precision;
    }
    _G(coin + "pricePrecision", pricePrecision);

}

//获取最小下单数量
function getQuantity(ex,ticker) {
    var coin = ex.GetCurrency();
    var quantity = 0;
    //当前总权益
    var totalEqNew = 0;
    //是否复利
    if (COMPOUND_INTEREST) {
        //当前账户总权益
        // totalEqNew = getTotalEquity();
        totalEqNew = CURR_TOTAL_EQ;
    } else {
        //非复利则使用初始总金额计算
        if (totalEq != -1) {
            totalEqNew = totalEq;
        } else {
            // totalEqNew = getTotalEquity();
            totalEqNew = CURR_TOTAL_EQ;
        }
    }

    //根据当前币价格计算下单数量--初始状态

    var quantityPrecision = _G(coin + "quantityPrecision");
    var q = totalEqNew * INIT_BUY_PROPORTION * MARGIN_LEVEL / ticker.Last;
    var initQuantity = q.toFixed(quantityPrecision);
    initQuantity = _N(parseFloat(initQuantity),quantityPrecision);
    // var initQuantity = _N(
    //         totalEqNew * INIT_BUY_PROPORTION * MARGIN_LEVEL / ticker.Last,
    //         quantityPrecision);
    //头寸
    var toucun = _N(totalEqNew * INIT_BUY_PROPORTION * MARGIN_LEVEL, 2);
    if (toucun < 5) {
        Log(coin + "最小下单金额*杠杆倍数小于5U，自动调整最小下单金额，建议重新设置相关参数");
        initQuantity = _N(5.1 / ticker.Last, quantityPrecision);
    }
    //重新计算初始下单量
    if (initQuantity * ticker.Last < 5) {
        if (quantityPrecision == 0) {
            initQuantity = initQuantity + 1;
            //再次计算下单的价值
            var bondNew = initQuantity * ticker.Last;
            var bondOld = totalEqNew * INIT_BUY_PROPORTION * MARGIN_LEVEL;
            //当需要下单的最小价格超过2倍初始时，不再跑这个币
            if (bondNew >= 2*bondOld) {
                initQuantity = 0;
                var manyStopBuy = _G(coin + "manyStopBuy");
                var shortStopBuy = _G(coin + "shortStopBuy");
                if (manyStopBuy != 1 || shortStopBuy != 1) {
                    Log(coin+"需要下单的最小金额超过设置金额的2倍，停止该币种交易", "#FF0000");
                    _G(coin + "manyStopBuy",1);
                    _G(coin + "shortStopBuy",1);
                }
            }
        }
    }


    if (FIRST_BUY_PROPORTION < INIT_BUY_PROPORTION) {
        FIRST_BUY_PROPORTION = INIT_BUY_PROPORTION;
    }
    var firstBuyQuantity = _N(
            totalEqNew * FIRST_BUY_PROPORTION * MARGIN_LEVEL / ticker.Last,
            quantityPrecision);

    _G(coin + "firstBuyQuantity", firstBuyQuantity);

    return initQuantity;
}

//判断是否存在订单
function checkPos(posDirection, ex) {
    var pos = getPos(ex);
    if (pos) {
        if (pos.length == 2) {
            return true;
        }
        if (pos.length == 1) {
            if (pos[0].Type == posDirection) {
                return true;
            }
        }
    }
    return false;
}

//判断价差，
function checkPriceDifference(posDirection, ex, quantity,ticker) {
    var coin = ex.GetCurrency();
    var q = quantity;
    // var ticker = _C(ex.GetTicker);
    updateProfit(ex,ticker);
    updateProfitRatio(posDirection, ex);
    //自适应补仓，在该币种当前仓位保证金大于每次补仓金额*50时，
    //例：1000初始，补仓比例为0.0005，每次补仓金额为0.5，当保证金大于25时，触发自适应高级补仓
    // 每次补仓降低浮亏/2
    var b = 0;
    //复利
    if (COMPOUND_INTEREST) {
        b = CURR_TOTAL_EQ * INIT_BUY_PROPORTION * 50;
    } else {
        b = totalEq * INIT_BUY_PROPORTION * 50;
    }
    if (posDirection == PD_LONG) {
        var manyProfit = _G(coin + "manyProfit");
        var replenishmentManyRatio = _G(coin + "replenishmentManyRatio");
        if (manyProfit < 0 && Math.abs(manyProfit) > replenishmentManyRatio
                * MARGIN_LEVEL * 100) {
            //当前浮亏超过补仓比例的值
            var threshold = Math.abs(manyProfit) - replenishmentManyRatio
                    * MARGIN_LEVEL * 100;
            var manyPosBond = _G(coin + "manyPosBond");
            if (manyPosBond >= b) {
                //超过补仓比例2个点的浮亏，就吧当前超过的浮亏补仓到减半
                var targetManyPrice = 0;
                if (threshold >= 6) {
                    targetManyPrice = _N(
                            ticker.Last * (1 + replenishmentManyRatio
                            + threshold / 2
                            / MARGIN_LEVEL / 100), _G(coin + "pricePrecision"));
                    //当前持仓均价
                    var oldManyPrice = _G(coin + "manyPrice");
                    //当前持仓数量
                    var oldManyPosNum = _G(coin + "manyPosNum");
                    // Log(coin+"自适应补仓");
                    // Log("targetManyPrice:" + targetManyPrice + ";oldManyPrice:" + oldManyPrice + ";oldManyPosNum:" + oldManyPosNum);
                    //需要补仓的数量
                    var n = _N(Math.abs(
                            oldManyPosNum * (oldManyPrice - targetManyPrice)
                            / (targetManyPrice - ticker.Last)),
                            _G(coin + "quantityPrecision"));
                    if (n > q) {
                        q = n;
                    }
                    //低于2个点直接补到补仓比例（废弃-----因为太容易在小幅度震荡中直接加到很高保证金，留足震荡的空间）
                    // targetManyPrice = _N(ticker.Last * (1 + replenishmentManyRatio ), _G(coin + "pricePrecision"));
                } else if (threshold >= 3) {
                    q = q * 5;
                } else {
                    q = q * 2;
                }

            } else {
                //超过补仓比例5个点的浮亏
                if (threshold >= 6) {
                    //（当前价格*要补的数量 + 当前平均持仓价格*持仓数量）/补仓后总持仓数量 = 补仓后均价
                    //补仓后均价/补仓后标记价格*20*100=补仓后浮盈/亏
                    //补仓后浮盈/亏要<= replenishmentManyRatio
                    //补仓后标记价格=预计浮盈/亏
                    //一次性补齐太容易没钱补，每次触发时，降低一定浮亏点，
                    //补仓后目标持仓价格
                    var targetManyPrice = _N(
                            ticker.Last * (1 + replenishmentManyRatio
                            + threshold / 2
                            / MARGIN_LEVEL / 100), _G(coin + "pricePrecision"));
                    //当前持仓均价
                    var oldManyPrice = _G(coin + "manyPrice");
                    //当前持仓数量
                    var oldManyPosNum = _G(coin + "manyPosNum");
                    // Log(coin+"自适应补仓");
                    // Log("targetManyPrice:" + targetManyPrice + ";oldManyPrice:" + oldManyPrice + ";oldManyPosNum:" + oldManyPosNum);
                    //需要补仓的数量
                    var n = _N(Math.abs(
                            oldManyPosNum * (oldManyPrice - targetManyPrice)
                            / (targetManyPrice - ticker.Last)),
                            _G(coin + "quantityPrecision"));
                    if (n > q) {
                        q = n;
                    }
                } else if (threshold >= 3) {
                    q = q * 2;
                }
            }
        }
        //开启根据保证金止损后
        //如果补仓后，保证金超过一定比例，直接止损
        if (OPEN_POS_BOND_LOSS) {
            var targetBond = manyPosBond + ticker.Last * q / MARGIN_LEVEL;
            if (targetBond >= POS_BOND_LOSS) {
                stopLoss(coin, ex, PD_LONG,ticker);
                return 0;
            }
        }
    } else if (posDirection == PD_SHORT) {
        var shortProfit = _G(coin + "shortProfit");
        var replenishmentShortRatio = _G(coin + "replenishmentShortRatio");
        if (shortProfit < 0 && Math.abs(shortProfit) > replenishmentShortRatio
                * MARGIN_LEVEL * 100) {
            var threshold = Math.abs(shortProfit) - replenishmentShortRatio
                    * MARGIN_LEVEL * 100;
            //当该币种的浮亏大于补仓一定比例，或者改币种仓位大于一定比例，这个时候补仓一般来不及
            var shortPosBond = _G(coin + "shortPosBond");
            if (shortPosBond >= b) {
                //补仓后目标持仓价格
                var targetShortPrice = 0;
                if (threshold >= 6) {
                    targetShortPrice = _N(
                            ticker.Last * (1 - replenishmentShortRatio
                            - threshold / 2
                            / MARGIN_LEVEL / 100), _G(coin + "pricePrecision"));

                    //当前持仓均价
                    var oldShortPrice = _G(coin + "shortPrice");
                    //当前持仓数量
                    var oldShortPosNum = _G(coin + "shortPosNum");
                    // Log(coin+"自适应补仓");
                    // Log("targetShortPrice:" + targetShortPrice + ";oldShortPrice:" + oldShortPrice + ";oldShortPosNum:" + oldShortPosNum);
                    //需要补仓的数量
                    var n = _N(Math.abs(
                            oldShortPosNum * (targetShortPrice - oldShortPrice)
                            / (ticker.Last
                            - targetShortPrice)), _G(coin + "quantityPrecision"));
                    if (n > q) {
                        q = n;
                    }
                    // targetShortPrice = _N(ticker.Last * (1 - replenishmentShortRatio), _G(coin + "pricePrecision"));
                } else if (threshold >= 3) {
                    q = q * 5;
                } else {
                    q = q * 2;
                }

            } else {
                if (threshold >= 6) {
                    //补仓后目标持仓价格
                    var targetShortPrice = _N(
                            ticker.Last * (1 - replenishmentShortRatio
                            - threshold / 2
                            / MARGIN_LEVEL / 100), _G(coin + "pricePrecision"));
                    //当前持仓均价
                    var oldShortPrice = _G(coin + "shortPrice");
                    //当前持仓数量
                    var oldShortPosNum = _G(coin + "shortPosNum");
                    // Log(coin+"自适应补仓");
                    // Log("targetShortPrice:" + targetShortPrice + ";oldShortPrice:" + oldShortPrice + ";oldShortPosNum:" + oldShortPosNum);
                    //需要补仓的数量
                    var n = _N(Math.abs(
                            oldShortPosNum * (targetShortPrice - oldShortPrice)
                            / (ticker.Last
                            - targetShortPrice)), _G(coin + "quantityPrecision"));
                    if (n > q) {
                        q = n;
                    }
                } else if (threshold >= 3) {
                    q = q * 2;
                }
            }
        }
        //开启根据保证金止损后
        //如果补仓后，保证金超过一定比例，直接止损
        if (OPEN_POS_BOND_LOSS) {
            var targetBond = shortPosBond + ticker.Last * q / MARGIN_LEVEL;
            if (targetBond >= POS_BOND_LOSS) {
                stopLoss(coin, ex, PD_SHORT,ticker);
                return 0;
            }
        }
    }
    return q;
}

//获取止盈比例-止盈比例为动态的--------依据斐波那契比例，加仓最大打15次，16次在复利模式下加不到，15次的时候约为7~8层仓位
//斐波那契加仓次数为1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,
//由于取消了加仓次数这个概念，所以切换为相对全仓的比例
//默认动态止盈触发为保证金占比5.5%--14%---32%------70%
//即保证金占比到5.5%时，止盈比例变为0.005-0.001=0.004
function updateProfitRatio(posDirection, ex) {
    var coin = ex.GetCurrency();
    //动态止盈触发条件
    var dynamic_profit_ratio = JUDGE_DYNAMIC_PROFIT_RATIO.split(',').map(Number);
    //动态补仓触发条件
    var dynamic_replenishment_ratio = JUDGE_DYNAMIC_REPLENISHMENT_RATIO.split(',').map(Number);

    if (posDirection == PD_LONG) {
        var manyPosBondRatio = _G(coin + "manyPosBondRatio");
        //开启动态止盈
        if (IS_OPEN_PROFIT) {
            var manyProfitRatioCount = _G(coin + "manyProfitRatioCount");
            var manyProfitRatio = _G(coin + "manyProfitRatio");
            if (manyPosBondRatio > dynamic_profit_ratio[manyProfitRatioCount]) {
                manyProfitRatio = manyProfitRatio + PROFIT_STEP;
                manyProfitRatioCount++;
                _G(coin + "manyProfitRatioCount", manyProfitRatioCount);
                _G(coin + "manyProfitRatio", manyProfitRatio);
            }
        }
        //开启动态补仓
        if (IS_OPEN_REPLENISHMENT_RATIO) {
            var replenishmentManyCount = _G(coin + "replenishmentManyCount");
            var replenishmentManyRatio = _G(coin + "replenishmentManyRatio");

            if (manyPosBondRatio
                    > dynamic_replenishment_ratio[replenishmentManyCount]) {
                replenishmentManyRatio = replenishmentManyRatio
                        + REPLENISHMENT_STEP;
                replenishmentManyCount++;
                _G(coin + "replenishmentManyCount", replenishmentManyCount);
                _G(coin + "replenishmentManyRatio", replenishmentManyRatio);
            }
        }
    } else if (posDirection == PD_SHORT) {
        var shortPosBondRatio = _G(coin + "shortPosBondRatio");
        if (IS_OPEN_PROFIT) {
            var shortProfitRatioCount = _G(coin + "shortProfitRatioCount");
            var shortProfitRatio = _G(coin + "shortProfitRatio");
            if (shortPosBondRatio
                    > dynamic_profit_ratio[shortProfitRatioCount]) {
                shortProfitRatio = shortProfitRatio + PROFIT_STEP;
                shortProfitRatioCount++;
                _G(coin + "shortProfitRatioCount", shortProfitRatioCount);
                _G(coin + "shortProfitRatio", shortProfitRatio);
            }
        }
        if (IS_OPEN_REPLENISHMENT_RATIO) {
            var replenishmentShortCount = _G(coin + "replenishmentShortCount");
            var replenishmentShortRatio = _G(coin + "replenishmentShortRatio");
            if (shortPosBondRatio
                    > dynamic_replenishment_ratio[replenishmentShortCount]) {
                replenishmentShortRatio = replenishmentShortRatio
                        + REPLENISHMENT_STEP;
                replenishmentShortCount++;
                _G(coin + "replenishmentShortCount", replenishmentShortCount);
                _G(coin + "replenishmentShortRatio", replenishmentShortRatio);
            }
        }
    }
}


//合约资金划转到现货
function usdtTransfer(cur, amount, type) {
    try {
        var base = '';
        var params = '';
        // 1: 现货账户向USDT合约账户划转
        // 2: USDT合约账户向现货账户划转
        // 3: 现货账户向币本位合约账户划转
        // 4: 币本位合约账户向现货账户划转
        //划转到现货
        //POST /sapi/v1/futures/transfer
        base = "https://api.binance.com";
        exchanges[0].SetBase(base);
        var timestamp = new Date().getTime();
        params = "asset=" + cur + "&amount=" + amount + "&type=" + type
                + "&timestamp" + timestamp;
        // params ={
        //     "asset": cur ,
        //     "amount": amount,
        //     "type" : type,
        //     "timestamp" : new Date().getTime()
        // }
        Log("合约划转至现货:", amount, "#FF0000");
        //var ret1 = exchanges[0].IO("api", "POST", "/sapi/v1/futures/transfer" ,"",  JSON.stringify( params ) )
        var ret1 = exchanges[0].IO("api", "POST", "/sapi/v1/futures/transfer", params);
        var usdtTransfer = _G("usdtTransfer");
        usdtTransfer = usdtTransfer + amount;
        _G("usdtTransfer",usdtTransfer);
        base = "https://fapi.binance.com";
        exchanges[0].SetBase(base);
        return ret1
    } catch (error) {
        Log(error)
    }
}

//贪心算法
function greedy(type, ex, quantity,ticker) {
    var coin = ex.GetCurrency();
    updateProfit(ex,ticker);
    if (type == PD_LONG) {
        _G(coin + "manyGreedyStatus", 1);
        var manyProfit = _G(coin + "manyProfit");
        var manyGreedyProfitRatioDown = _G(coin + "manyGreedyProfitRatioDown");
        var manyGreedyProfitRatioUp = _G(coin + "manyGreedyProfitRatioUp");

        if (manyGreedyProfitRatioDown == 0) {
            manyGreedyProfitRatioDown = manyProfit * (1 - GREEDY_INTERVAL_DOWN);
            manyGreedyProfitRatioUp = manyProfit * (1 + GREEDY_INTERVAL_UP);
            _G(coin + "manyGreedyProfitRatioDown", manyGreedyProfitRatioDown);
            _G(coin + "manyGreedyProfitRatioUp", manyGreedyProfitRatioUp);
        }
        if (manyProfit >= manyGreedyProfitRatioUp) {
            manyGreedyProfitRatioDown = manyProfit * (1 - GREEDY_INTERVAL_DOWN);
            manyGreedyProfitRatioUp = manyProfit * (1 + GREEDY_INTERVAL_UP);
            // Log(coin + "当前多单浮盈：" + manyProfit + ";贪心上限:" + manyGreedyProfitRatioUp + ";贪心下限:" + manyGreedyProfitRatioDown);
            _G(coin + "manyGreedyProfitRatioDown", manyGreedyProfitRatioDown);
            _G(coin + "manyGreedyProfitRatioUp", manyGreedyProfitRatioUp);
        } else if (manyProfit <= manyGreedyProfitRatioDown) {
            Log(coin + "多单触发贪心止盈:" + manyProfit + "%", "#FF0000");
            _G(coin + "manyGreedyStatus", 0);
            manySell(1, ex, 1,ticker);
            openPos(coin, quantity, ex, type, true,ticker);
        }
    } else if (type == PD_SHORT) {
        _G(coin + "shortGreedyStatus", 1);
        var shortProfit = _G(coin + "shortProfit");
        var shortGreedyProfitRatioDown = _G(
                coin + "shortGreedyProfitRatioDown");
        var shortGreedyProfitRatioUp = _G(coin + "shortGreedyProfitRatioUp");

        if (shortGreedyProfitRatioDown == 0) {
            shortGreedyProfitRatioDown = shortProfit * (1
                    - GREEDY_INTERVAL_DOWN);
            shortGreedyProfitRatioUp = shortProfit * (1 + GREEDY_INTERVAL_UP);
            _G(coin + "shortGreedyProfitRatioDown", shortGreedyProfitRatioDown);
            _G(coin + "shortGreedyProfitRatioUp", shortGreedyProfitRatioUp);

        }
        if (shortProfit >= shortGreedyProfitRatioUp) {
            shortGreedyProfitRatioDown = shortProfit * (1
                    - GREEDY_INTERVAL_DOWN);
            shortGreedyProfitRatioUp = shortProfit * (1 + GREEDY_INTERVAL_UP);
            // Log(coin + "当前空单浮盈：" + shortProfit + ";贪心上限:" + shortGreedyProfitRatioUp + ";贪心下限:" + shortGreedyProfitRatioDown);
            _G(coin + "shortGreedyProfitRatioDown", shortGreedyProfitRatioDown);
            _G(coin + "shortGreedyProfitRatioUp", shortGreedyProfitRatioUp);
        } else if (shortProfit <= shortGreedyProfitRatioDown) {
            Log(coin + "空单触发贪心止盈:" + shortProfit + "%", "#FF0000");
            _G(coin + "shortGreedyStatus", 0);
            shortSell(1, ex, 1,ticker);
            openPos(coin, quantity, ex, type, true,ticker);
        }
    }
}

//模拟资金增加手续费
function serviceCharge(coin,price,quantity) {

    var cost = price * quantity * SERVICE_CHARGE_RATIO/100;
    //可用资金减少
    var available_funds = _G("available_funds");
    _G("available_funds",available_funds - cost);
    //总资金减少
    var simulatedEq = _G("simulatedEq");
    _G("simulatedEq",simulatedEq - cost);
    //记录该币种总共手续费
    var coinCharge = _G(coin + "charge");
    _G(coin + "charge",coinCharge + cost);
}


function manyBuy(quantity, ex,ticker) {
    var coin = ex.GetCurrency();
    var pinManyStatus = _G(coin + "pinManyStatus");
    if (pinManyStatus == 1) {
        return;
    }
    // var ticker = _C(ex.GetTicker);
    if (quantity > 0) {
        if (!ticker) {
            ticker = _C(ex.GetTicker);
        }
        if (IS_OPEN_SIMULATED_FUNDS) {
            //模拟下单
            Log(coin + "开多;价格:" + ticker.Last + ";数量:" + quantity);
            //手续费
            serviceCharge(coin,ticker.Last,quantity);
            createPos(ticker.Last, quantity, PD_LONG, ex,ticker);
            // updatePos(ex);
            // updateTable();
            //更新均价,止盈价,仓位
            // updateProfitRatio(PD_LONG, ex);
            // updateProfit(ex);
            if (!IS_HUICHE) {
                recodeDetail(PD_LONG, ticker.Last, ex);
            }
        } else {
            var price = _N(ticker.Sell * (1 + ADD_PRICE_PROPORTION),
                    _G(coin + "pricePrecision"));
            ex.SetDirection("buy");
            let orderId = ex.Buy(price, quantity);
            // let orderId = ex.Buy(-1, quantity);
            if (orderId) {
                //判断是否成交
                while (true) {
                    let order = ex.GetOrder(orderId);
                    if (null === order) {
                        Log(999);
                        break
                    }
                    // 买入成功处理
                    if (1 === order.Status || 2 === order.Status) {
                        // updateTable();
                        //更新均价,止盈价，下一次补仓价,仓位
                        // updateProfitRatio(PD_LONG, ex);
                        // updateProfit(ex);
                        if (!IS_HUICHE) {
                            recodeDetail(PD_LONG, price, ex);
                        }
                        //实盘也维护自己的模拟仓，只需要按时去更新同步就行
                        createPos(ticker.Last, quantity, PD_LONG, ex,ticker);
                        break
                    } else {
                        try {
                            //取消挂单，重新下单
                            ex.CancelOrder(orderId);
                            Log(coin + "订单未成交，取消订单，重新下单");
                            var tickerNew = _C(ex.GetTicker);
                            manyBuy(quantity, ex,tickerNew);
                        } catch (e) {
                            Log(e);
                            Log(coin + "订单异常,跳过本轮交易")
                        }
                    }
                }
            } else {
                Log(coin + "下单失败，跳过本轮交易");
            }
        }
    } else {
        Log(coin + "下单失败，原因是下单数量为0");
    }
}

function shortBuy(quantity, ex,ticker) {
    var coin = ex.GetCurrency();
    var pinShortStatus = _G(coin + "pinShortStatus");
    if (pinShortStatus == 1) {
        return;
    }
    // var ticker = _C(ex.GetTicker);
    if (quantity > 0) {
        if (!ticker) {
            ticker = _C(ex.GetTicker);
        }
        if (IS_OPEN_SIMULATED_FUNDS) {
            //模拟下单
            Log(coin + "开空;价格:" + ticker.Last + ";数量:" + quantity);
            //手续费
            serviceCharge(coin,ticker.Last,quantity);
            createPos(ticker.Last, quantity, PD_SHORT, ex,ticker);
            // updatePos(ex);
            // updateTable();
            //更新均价,止盈价，下一次补仓价,仓位
            // updateProfitRatio(PD_SHORT, ex);
            // updateProfit(ex);

            if (!IS_HUICHE) {
                recodeDetail(PD_SHORT, ticker.Last, ex);
            }
        } else {
            ex.SetDirection("sell");
            var price = _N(ticker.Buy * (1 - ADD_PRICE_PROPORTION),
                    _G(coin + "pricePrecision"));
            let orderId = ex.Sell(price, quantity);
            // let orderId = ex.Sell(-1, quantity);
            if (orderId) {
                //判断是否成交
                while (true) {
                    let order = ex.GetOrder(orderId);
                    if (null === order) {
                        Log(999);
                        break
                    }
                    // 买入成功处理
                    if (1 === order.Status || 2 === order.Status) {
                        // updateTable();
                        //更新均价,止盈价，下一次补仓价,仓位
                        // updateProfitRatio(PD_SHORT, ex);
                        // updateProfit(ex);

                        if (!IS_HUICHE) {
                            recodeDetail(PD_SHORT, price, ex);
                        }
                        //实盘也维护自己的模拟仓，只需要按时去更新同步就行
                        createPos(ticker.Last, quantity, PD_SHORT, ex,ticker);
                        break
                    } else {
                        //取消挂单，重新下单
                        try {
                            ex.CancelOrder(orderId);
                            Log(coin + "订单未成交，取消订单，重新下单");
                            var tickerNew = _C(ex.GetTicker);
                            shortBuy(quantity, ex,tickerNew);
                        } catch (e) {
                            Log(e);
                            Log(coin + "订单异常,跳过本轮交易")
                        }
                    }
                }
            } else {
                Log(coin + "下单失败，跳过本轮交易");
            }
        }

    } else {
        Log(coin + "下单失败，原因是下单数量为0");
    }
    // updateProfit(ex);
}

// 平多
function manySell(quantity, ex, greedyType,ticker) {
    var coin = ex.GetCurrency();
    if (!ticker) {
        ticker = _C(ex.GetTicker);
    }
    var pos = getPos(ex,ticker);
    if (!pos || pos.length == 0) {
        return
    }
    for (var i = 0; i < pos.length; i++) {
        if (pos[i].Type == PD_LONG) {
            if (IS_OPEN_SIMULATED_FUNDS) {

                Log(coin + "多头持仓均价:" + pos[i].Price + ";多头持仓保证金:"
                        + pos[i].Margin
                        + ";当前标记价格："
                        + ticker.Last + "浮盈/亏:" + pos[i].Profit);
                var simulatedEq = _G("simulatedEq");
                simulatedEq = simulatedEq + pos[i].Profit;
                _G("simulatedEq", simulatedEq);

                if (quantity < 1) {
                    var quantityPrecision = _G(coin + "quantityPrecision");

                    var amount = _N(pos[i].Amount * quantity,
                            quantityPrecision);
                    //手续费
                    serviceCharge(coin,ticker.Last,amount);
                    deletePartPos(PD_LONG, amount, ticker.Last, ex)

                } else {
                    serviceCharge(coin,ticker.Last,pos[i].Amount);
                    deletePos(PD_LONG, ex);
                }
                // updatePos(ex);
                // updateTable();
                // updateProfit(ex);
                if (!IS_HUICHE) {
                    insertDetail(PD_LONG, pos[i].Price, ticker.Last,
                            pos[i].Margin,
                            pos[i].Profit, ex);
                    _G(coin + "manyStatus", 0);

                    _G(coin + "maxManyLostProfit", 0);
                }
                _G(coin + "manyProfitRatio", INIT_PROFIT_RATIO);
                _G(coin + "manyProfitRatioCount", 0);
                _G(coin + "manyPosBond", 0);
                _G(coin + "manyProfit", 0);
                _G(coin + "manyPosBondRatio", 0);
                _G(coin + "replenishmentManyRatio", INIT_REPLENISHMENT_RATIO);
                _G(coin + "replenishmentManyCount", 0);

                _G(coin + "manyGreedyProfitRatioDown", 0);
                _G(coin + "manyGreedyProfitRatioUp", 0);

                _G(coin + "manyPrice", 0);
                _G(coin + "manyPosNum", 0);

                statisticEq();
            } else {
                ex.SetDirection("closebuy");
                var amount = 0;
                if (quantity < 1) {
                    var quantityPrecision = _G(coin + "quantityPrecision");
                    amount = _N(pos[i].Amount * quantity, quantityPrecision);
                    deletePartPos(PD_LONG, amount, ticker.Last, ex)
                } else {
                    amount = pos[i].Amount;
                    deletePos(PD_LONG, ex);
                }
                var price = ticker.Buy * (1 - ADD_PRICE_PROPORTION);
                //如果是触发贪心止盈的，直接市价平
                if (greedyType == 1) {
                    ex.Sell(-1, amount);
                } else {
                    ex.Sell(price, amount);
                }

                Log(coin + "多头持仓均价:" + pos[i].Price + ";多头持仓保证金:"
                        + pos[i].Margin
                        + ";当前标记价格："
                        + ticker.Last + "浮盈/亏:" + pos[i].Profit);
                // updateTable();
                // updateProfit(ex);

                if (!IS_HUICHE) {
                    insertDetail(PD_LONG, pos[i].Price, ticker.Last,
                            pos[i].Margin,
                            pos[i].Profit, ex);
                    _G(coin + "manyStatus", 0);
                    _G(coin + "maxManyLostProfit", 0);
                }

                _G(coin + "manyProfitRatio", INIT_PROFIT_RATIO);
                _G(coin + "manyProfitRatioCount", 0);
                _G(coin + "manyPosBond", 0);
                _G(coin + "manyProfit", 0);
                _G(coin + "manyPosBondRatio", 0);
                _G(coin + "replenishmentManyRatio", INIT_REPLENISHMENT_RATIO);
                _G(coin + "replenishmentManyCount", 0);

                _G(coin + "manyGreedyProfitRatioDown", 0);
                _G(coin + "manyGreedyProfitRatioUp", 0);

                _G(coin + "manyPrice", 0);
                _G(coin + "manyPosNum", 0);

                statisticEq();
            }
        }
    }
    // updateProfit(ex);
}

//平空
function shortSell(quantity, ex, greedyType,ticker) {
    var coin = ex.GetCurrency();
    if (!ticker) {
        ticker = _C(ex.GetTicker);
    }
    var pos = getPos(ex,ticker);
    if (!pos || pos.length == 0) {
        return
    }
    for (var i = 0; i < pos.length; i++) {
        if (pos[i].Type == PD_SHORT) {
            if (IS_OPEN_SIMULATED_FUNDS) {
                Log(coin + "空头持仓均价:" + pos[i].Price + ";空头持仓保证金:"
                        + pos[i].Margin
                        + ";当前标记价格："
                        + ticker.Last + "浮盈/亏:" + pos[i].Profit);
                var simulatedEq = _G("simulatedEq");
                simulatedEq = simulatedEq + pos[i].Profit;
                _G("simulatedEq", simulatedEq);

                if (quantity < 1) {
                    var quantityPrecision = _G(coin + "quantityPrecision");
                    amount = _N(pos[i].Amount * quantity, quantityPrecision);

                    //手续费
                    serviceCharge(coin,ticker.Last,amount);
                    deletePartPos(PD_SHORT, amount, ticker.Last, ex);
                } else {
                    //手续费
                    serviceCharge(coin,ticker.Last,pos[i].Amount);
                    deletePos(PD_SHORT, ex);
                }
                // updatePos(ex);

                // updateTable();
                // updateProfit(ex);

                if (!IS_HUICHE) {
                    insertDetail(PD_SHORT, pos[i].Price, ticker.Last,
                            pos[i].Margin,
                            pos[i].Profit, ex);
                    _G(coin + "shortStatus", 0);
                    _G(coin + "maxShortLostProfit", 0);
                }

                _G(coin + "shortProfitRatio", INIT_PROFIT_RATIO);
                _G(coin + "shortProfitRatioCount", 0);
                _G(coin + "shortPosBond", 0);
                _G(coin + "shortProfit", 0);
                _G(coin + "shortPosBondRatio", 0);
                _G(coin + "replenishmentShortRatio", INIT_REPLENISHMENT_RATIO);
                _G(coin + "replenishmentShortCount", 0);

                _G(coin + "shortGreedyProfitRatioDown", 0);
                _G(coin + "shortGreedyProfitRatioUp", 0);

                _G(coin + "shortPrice", 0);
                _G(coin + "shortPosNum", 0);

                statisticEq();
            } else {
                ex.SetDirection("closesell");
                var amount = 0;
                if (quantity < 1) {
                    var quantityPrecision = _G(coin + "quantityPrecision");
                    amount = _N(pos[i].Amount * quantity, quantityPrecision);
                    deletePartPos(PD_SHORT, amount, ticker.Last, ex);
                } else {
                    amount = pos[i].Amount;
                    deletePos(PD_SHORT, ex);
                }
                // ex.Buy(-1,amount);
                var price = ticker.Sell * (1 + ADD_PRICE_PROPORTION);
                //如果触发贪心止盈，直接市价平
                if (greedyType == 1) {
                    ex.Buy(-1, amount);
                } else {
                    ex.Buy(price, amount);
                }

                Log(coin + "空头持仓均价:" + pos[i].Price + ";空头持仓保证金:"
                        + pos[i].Margin
                        + ";当前标记价格："
                        + ticker.Last + "浮盈/亏:" + pos[i].Profit);
                // updateTable();
                // updateProfit(ex);

                if (!IS_HUICHE) {
                    insertDetail(PD_SHORT, pos[i].Price, ticker.Last,
                            pos[i].Margin,
                            pos[i].Profit, ex);
                    _G(coin + "shortStatus", 0);
                    _G(coin + "maxShortLostProfit", 0);
                }

                _G(coin + "shortProfitRatio", INIT_PROFIT_RATIO);
                _G(coin + "shortProfitRatioCount", 0);
                _G(coin + "shortPosBond", 0);
                _G(coin + "shortProfit", 0);
                _G(coin + "shortPosBondRatio", 0);
                _G(coin + "replenishmentShortRatio", INIT_REPLENISHMENT_RATIO);
                _G(coin + "replenishmentShortCount", 0);

                _G(coin + "shortGreedyProfitRatioDown", 0);
                _G(coin + "shortGreedyProfitRatioUp", 0);

                _G(coin + "shortPrice", 0);
                _G(coin + "shortPosNum", 0);

                statisticEq();
            }
        }
    }
    // updateProfit(ex);
}

function tradeMany(quantity, ex,ticker) {
    var coin = ex.GetCurrency();
    var manyGreedyStatus = _G(coin + "manyGreedyStatus");

    if (checkPos(PD_LONG, ex)) {
        if (manyGreedyStatus == 1) {
            greedy(PD_LONG, ex, quantity,ticker);
        } else {
            updateProfit(ex,ticker);
            updateProfitRatio(PD_LONG, ex);
            // getTotalEquity();
            //判断止盈/补仓/止损
            //当总仓位超过一定比例时，停止下单，等待止损或者止盈
            var available_funds = _G("available_funds");
            var manyPosBond = _G(coin + "manyPosBond");
            var manyProfit = _G(coin + "manyProfit");
            var manyProfitRatio = _G(coin + "manyProfitRatio");
            var replenishmentManyRatio = _G(coin + "replenishmentManyRatio");
            //当前浮盈亏金额
            var profitAmount = Math.abs(manyProfit) * manyPosBond / 100;

            if (manyPosBond >= BOND_ALARM) {
                Log(coin + "多头保证金达到预警值", "#FF0000@")
            }

            //开启根据保证金止损后 如果保证金超过一定比例，直接止损
            if (OPEN_POS_BOND_LOSS) {
                if (manyPosBond >= POS_BOND_LOSS) {
                    //止损
                    stopLoss(coin, ex, PD_LONG,ticker);
                    return;
                }
            }
            //开启根据浮亏止损，如果浮亏超过一定金额，直接止损
            if (OPEN_POS_PROFIT_LOSS) {
                if (manyProfit < 0 && profitAmount >= POS_PROFIT_LOSS) {
                    //止损
                    stopLoss(coin, ex, PD_LONG,ticker);
                }
            }

            if (available_funds <= CURR_TOTAL_EQ * (1 + 0.05
                    - STOP_LOSS_RELATIVE_ALL_POS)) {
                if (manyProfit < 0 && Math.abs(manyProfit) >= STOP_LOSS_RATIO * 100) {
                    //止损
                    stopLoss(coin, ex, PD_LONG,ticker);
                } else {
                    if (manyProfit > 0 && manyProfit >= manyProfitRatio * MARGIN_LEVEL * 100) {
                        //止盈
                        startWin(coin, quantity, manyPosBond, manyProfit, ex, PD_LONG,ticker);
                    }
                }
            } else {
                if (manyProfit > 0 && manyProfit >= manyProfitRatio * MARGIN_LEVEL * 100) {
                    //止盈
                    startWin(coin, quantity, manyPosBond, manyProfit, ex, PD_LONG,ticker);
                } else if (manyProfit < 0 && Math.abs(manyProfit) >= replenishmentManyRatio * MARGIN_LEVEL * 100) {

                    var manyStopBuy = _G(coin + "manyStopBuy");
                    //manyStopBuy = 1时停止多单下单
                    if (manyStopBuy != 1) {
                        //夜间模式
                        if (NIGTH_MODE && manyPosBond >=  NIGTH_MODE_BOND) {
                            return;
                        }
                        var pinManyTime = _G(coin + "pinManyTime");
                        var nowTime = _N(Unix(),0);
                        if (nowTime - pinManyTime < PIN_DELAY*60) {
                            return;
                        }

                        var q = checkPriceDifference(PD_LONG, ex, quantity,ticker);
                        if (q > 0) {
                            // Log(coin + "补多：" + manyProfit + "%");
                            openPos(coin, q, ex, PD_LONG, false,ticker);
                        }
                    }
                }
            }
        }
    } else {
        //修复手动在app止盈后，由于此时程序处于贪心状态，永远不会下单
        if (manyGreedyStatus != 0) {
            _G(coin + "manyGreedyStatus",0);
        }
        //如果没开启防插针，就去判断这个，否则防插针里面自动判断了rsi，就不需要每次都去调用
        if (!OPEN_DEF_PIN) {
            checkRsi(ex);
        }
        var manyStopBuy = _G(coin + "manyStopBuy");
        //manyStopBuy = 1时停止多单下单
        if (manyStopBuy != 1) {
            // 开仓
            openPos(coin, quantity, ex, PD_LONG, true,ticker);
        }
    }
}

function tradeShort(quantity, ex,ticker) {
    var coin = ex.GetCurrency();
    var shortGreedyStatus = _G(coin + "shortGreedyStatus");

    if (checkPos(PD_SHORT, ex)) {
        if (shortGreedyStatus == 1) {
            greedy(PD_SHORT, ex, quantity,ticker);
        } else {
            updateProfit(ex,ticker);
            updateProfitRatio(PD_SHORT, ex);
            // getTotalEquity();
            //判断止盈/补仓/止损
            //当总仓位超过一定比例时，停止下单，等待止损或者止盈
            var available_funds = _G("available_funds");
            var shortPosBond = _G(coin + "shortPosBond");
            var shortProfit = _G(coin + "shortProfit");
            var shortProfitRatio = _G(coin + "shortProfitRatio");
            var replenishmentShortRatio = _G(coin + "replenishmentShortRatio");
            //当前浮盈亏金额
            var profitAmount = Math.abs(shortProfit) * shortPosBond / 100;

            if (shortPosBond >= BOND_ALARM) {
                Log(coin + "空头保证金达到预警值", "#FF0000@")
            }

            //开启根据保证金止损后 如果保证金超过一定比例，直接止损
            if (OPEN_POS_BOND_LOSS) {
                if (shortPosBond >= POS_BOND_LOSS) {
                    //止损
                    stopLoss(coin, ex, PD_SHORT,ticker);
                }
            }
            //开启根据浮亏止损，如果浮亏超过一定金额，直接止损
            if (OPEN_POS_PROFIT_LOSS) {
                if (shortProfit < 0 && profitAmount >= POS_PROFIT_LOSS) {
                    //止损
                    stopLoss(coin, ex, PD_SHORT,ticker);
                }
            }

            if (available_funds <= CURR_TOTAL_EQ * (1 + 0.05 - STOP_LOSS_RELATIVE_ALL_POS)) {
                //当当前币种浮亏达到其补仓比例时止损
                if (shortProfit < 0 && Math.abs(shortProfit) >= STOP_LOSS_RATIO * 100) {
                    //止损
                    stopLoss(coin, ex, PD_SHORT,ticker);
                } else {
                    if (shortProfit > 0 && shortProfit >= shortProfitRatio * MARGIN_LEVEL * 100) {
                        //止盈
                        startWin(coin, quantity, shortPosBond, shortProfit, ex, PD_SHORT,ticker);
                    }
                }
            } else {
                if (shortProfit > 0 && shortProfit >= shortProfitRatio * MARGIN_LEVEL * 100) {
                    //止盈
                    startWin(coin, quantity, shortPosBond, shortProfit, ex, PD_SHORT,ticker);
                } else if (shortProfit < 0 && Math.abs(shortProfit) >= replenishmentShortRatio * MARGIN_LEVEL * 100) {
                    var shortStopBuy = _G(coin + "shortStopBuy");
                    if (shortStopBuy != 1) {
                        //夜间模式
                        if (NIGTH_MODE && shortPosBond >=  NIGTH_MODE_BOND) {
                            return;
                        }
                        var pinShortTime = _G(coin + "pinShortTime");
                        var nowTime = _N(Unix(),0);
                        if (nowTime - pinShortTime < PIN_DELAY*60) {
                            return;
                        }

                        var q = checkPriceDifference(PD_SHORT, ex, quantity,ticker);
                        if (q > 0) {
                            // Log(coin + "补空：" + shortProfit + "%");
                            openPos(coin, q, ex, PD_SHORT,false,ticker);
                        }
                    }
                }
            }
        }


    } else {
        //修复手动在app止盈后，由于此时程序处于贪心状态，永远不会下单
        if (shortGreedyStatus != 0) {
            _G(coin + "shortGreedyStatus",0);
        }

        //如果没开启防插针，就去判断这个，否则防插针里面自动判断了rsi，就不需要每次都去调用
        if (!OPEN_DEF_PIN) {
            checkRsi(ex);
        }
        var shortStopBuy = _G(coin + "shortStopBuy");
        if (shortStopBuy != 1) {
            // 开仓
            openPos(coin, quantity, ex, PD_SHORT, true,ticker);
        }

    }
}

//止损
function stopLoss(coin, ex, typePos,ticker) {

    //是否在止损位置选择扛单
    if (!CARRY_BILL) {
        if (typePos == PD_LONG) {
            if (IS_OPEN_PART_LOSS) {
                Log(coin + "多单触发部分止损", "#FF0000@");
                manySell(PART_LOSS_RATIO, ex, 0,ticker)
            } else {
                Log(coin + "多单触发直接止损", "#FF0000@");
                manySell(1, ex, 0,ticker);
            }
        } else {
            if (IS_OPEN_PART_LOSS) {
                Log(coin + "空单触发部分止损", "#FF0000@");
                shortSell(PART_LOSS_RATIO, ex, 0,ticker);
            } else {
                Log(coin + "空单触发直接止损", "#FF0000@");
                shortSell(1, ex, 0,ticker);
            }

        }
        //判断rsi，当前是否属于超买超卖状态，是就不下反方向单
        //如果没开启防插针，就去判断这个，否则防插针里面自动判断了rsi，就不需要每次都去调用
        if (!OPEN_DEF_PIN) {
            checkRsi(ex);
        }
    } else {
        if (typePos == PD_LONG) {
            Log(coin + "多单已经达到止损位！扛单中","#FF0000@");
        } else {
            Log(coin + "空单已经达到止损位！扛单中","#FF0000@");
        }
    }
}

//止盈
function startWin(coin, quantity, posBond, profit, ex, typePos,ticker) {
    if (typePos == PD_LONG) {
        var manyStopBuy = _G(coin + "manyStopBuy");
        if (manyStopBuy == 1) {
            _G(coin + "manyStopBuy",0);
            Log(coin+"止盈后恢复开多", "#FF0000");
        }
        //开启贪心止盈 并且保证金大于指定金额就进入贪心止盈
        if (OPEN_GREEDY && posBond >= GREEDY_BOND) {
            greedy(typePos, ex, quantity);
        } else {
            //正常止盈
            Log(coin + "多单触发止盈:" + profit + "%", "#FF0000");
            manySell(1, ex, 0,ticker);
            openPos(coin, quantity, ex, typePos,true,ticker)
        }

    } else {
        var shortStopBuy = _G(coin + "shortStopBuy");
        if (shortStopBuy == 1) {
            _G(coin + "shortStopBuy",0);
            Log(coin+"止盈后恢复开空", "#FF0000");
        }
        if (OPEN_GREEDY && posBond >= GREEDY_BOND) {
            greedy(typePos, ex, quantity);
        } else {
            Log(coin + "空单触发止盈:" + profit + "%", "#FF0000");
            shortSell(1, ex, 0,ticker);
            openPos(coin, quantity, ex, typePos,true,ticker);
        }
    }
}

//开仓
function openPos(coin, quantity, ex, typePos, emptyPos,ticker) {
    if (typePos == PD_LONG) {
        if (emptyPos) {
            if (!CLOSE_BUY) {
                //判断当前是否处于超卖状态，是则不开多单0否1是
                var rsiSuper = _G(coin + "rsiSuper");
                if (rsiSuper != 2) {
                    //是否开启根据均线趋势加大头仓功能
                    if (OPEN_CROSS_POS_ADD) {
                        //根据均线判断当时头仓是否开大
                        var status = _G(coin + "crossStatus");
                        //0震荡1涨2跌
                        if (status == 1) {
                            var firstBuyQuantity = _G(coin + "firstBuyQuantity");
                            if (firstBuyQuantity && firstBuyQuantity != 0) {
                                Log(coin + "系统预测要涨", "#0000FF");
                                quantity = firstBuyQuantity;
                                //降低该方向止盈比例，加快出仓速度，避免站岗
                                _G(coin + "manyProfitRatio", INIT_PROFIT_RATIO + CROSS_PROFIT_STEP);
                            }
                        }
                    }
                    manyBuy(quantity, ex,ticker)
                }
            }
        } else {
            manyBuy(quantity, ex,ticker)
        }
    } else {
        if (emptyPos) {
            if (!CLOSE_BUY) {
                //判断当前是否处于超买状态，是则不开空单0否1是
                var rsiSuper = _G(coin + "rsiSuper");
                if (rsiSuper != 1) {
                    //是否开启根据均线趋势加大头仓功能
                    if (OPEN_CROSS_POS_ADD) {
                        //根据均线判断当时头仓是否开大
                        var status = _G(coin + "crossStatus");
                        //0震荡1涨2跌
                        if (status == 2) {
                            var firstBuyQuantity = _G(coin + "firstBuyQuantity");
                            if (firstBuyQuantity && firstBuyQuantity != 0) {
                                Log(coin + "系统预测要跌", "#0000FF");
                                quantity = firstBuyQuantity;
                                //降低该方向止盈比例，加快出仓速度，避免站岗
                                _G(coin + "shortProfitRatio", INIT_PROFIT_RATIO + CROSS_PROFIT_STEP);
                            }
                        }
                    }
                    shortBuy(quantity, ex,ticker);
                }
            }
        } else {
            shortBuy(quantity, ex,ticker);
        }
    }
}


function onTick(ex) {
    var coin = ex.GetCurrency();
    //定时取K线数据判断趋势
    scheduledTaskCross(ex);
    //开启防插针系统
    if (OPEN_DEF_PIN) {
        defensePin(ex);
    }
    // var lockPosStatus = _G(coin + "lockPosStatus");
    // if (lockPosStatus == 0) {
    //
    // }

    var ticker = _C(ex.GetTicker);
    var quantity = getQuantity(ex,ticker);
    //默认自适应单开
    // if (SELF_ADAPTION) {
    //     var status = _G(coin + "crossStatus");
    //     //0震荡1涨2跌
    //     if (status == 1) {
    //         //平掉反方向仓位
    //         shortSell(1, ex, 0);
    //         tradeMany(quantity, ex);
    //     } else if (status == 2) {
    //         //平掉反方向仓位
    //         manySell(1, ex, 0);
    //         tradeShort(quantity, ex);
    //     } else {
    //         //在震荡时根据小时线判断方向
    //         var n = hourCross(ex);
    //         if (n > 0) {
    //             //平掉反方向仓位
    //             shortSell(1, ex, 0);
    //             tradeMany(quantity, ex);
    //         } else if (n < 0) {
    //             //平掉反方向仓位
    //             manySell(1, ex, 0);
    //             tradeShort(quantity, ex);
    //         }
    //     }
    // } else {
    //     //手动选择多
    //     if (DIRECTION_MANY) {
    //         tradeMany(quantity, ex);
    //     }
    //     //手动选择空
    //     if (DIRECTION_SHORT) {
    //         tradeShort(quantity, ex);
    //     }
    // }
    tradeMany(quantity, ex,ticker);
    tradeShort(quantity, ex,ticker);
    _G(coin + "tickerLast",ticker.Last);

    if (!IS_OPEN_SIMULATED_FUNDS) {
        var ret = _C(exchanges[0].GetAccount);
        var available_funds = ret.Balance;
        _G("available_funds", available_funds);
    }
}

function handleCMD() {
    var cmd = GetCommand();
    if (cmd) {
        Log("cmd:", cmd);
        var arr = cmd.split(":");
        if (arr[0] == "limitPage") {
            LIMIT = arr[1];
        } else if (arr[0] == "reset") {
            OFFSET = 0;
            ORDER_STATUS = false;
        } else if (arr[0] == "orderBy") {
            ORDER_STATUS = true;
            BOND_VALUE = arr[1];
        } else if (arr[0] == "sellAll") {
            Log("一键平仓");
            for (var i = 0; i < exchanges.length; i++) {
                var pos = getPos(exchanges[i]);
                if (pos) {
                    manySell(1, exchanges[i], 0);
                    shortSell(1, exchanges[i], 0);
                }
            }
            STOP_ROBOT_STATUS = true;
        } else if (arr[0] == "closeBuy") {
            Log("止盈后不再下单");
            CLOSE_BUY = true;
        } else if (arr[0] == "openBuy") {
            Log("开始下单");
            CLOSE_BUY = false;
        } else if (arr[0] == "openNightMode") {
            NIGTH_MODE = true;
            if (COMPOUND_INTEREST) {
                NIGTH_MODE_BOND = CURR_TOTAL_EQ * arr[1];
            } else {
                NIGTH_MODE_BOND = totalEq * arr[1];
            }
        } else if (arr[0] == "closeNightMode") {
            NIGTH_MODE = false;
        } else {
            for (var j = 0;j < exchanges.length;j++) {
                var coin = exchanges[j].GetCurrency();
                if (arr[0] == coin + "manyStopBuy") {
                    _G(coin + "manyStopBuy",1);
                    Log(coin+"手动停止多单", "#FF0000");
                } else if (arr[0] == coin + "manyStartBuy") {
                    _G(coin + "manyStopBuy",0);
                    Log(coin+"手动恢复多单", "#FF0000");
                } else if (arr[0] == coin + "shortStopBuy") {
                    _G(coin + "shortStopBuy",1);
                    Log(coin+"手动停止空单", "#FF0000");
                } else if (arr[0] == coin + "shortStartBuy") {
                    _G(coin + "shortStopBuy",0);
                    Log(coin+"手动恢复空单", "#FF0000");
                } else if (arr[0] == coin + "manySellHalf") {
                    Log(coin+"手动平一半多仓", "#FF0000");
                    manySell(0.5, exchanges[j], 0);
                } else if (arr[0] == coin + "manySellAll") {
                    Log(coin+"手动平全部多仓", "#FF0000");
                    manySell(1, exchanges[j], 0);
                } else if (arr[0] == coin + "shortSellHalf") {
                    Log(coin+"手动平一半空仓", "#FF0000");
                    shortSell(0.5, exchanges[j], 0);
                } else if (arr[0] == coin + "shortSellAll") {
                    Log(coin+"手动平全部空仓", "#FF0000");
                    shortSell(1, exchanges[j], 0);
                }
            }
        }
    }
}

function initData(ex) {
    // 开合约
    var coin = ex.GetCurrency();
    Log("初始化"+coin+"开始");
    ex.SetContractType("swap");
    ex.SetMarginLevel(MARGIN_LEVEL);
    ex.IO("cross", true);    // 切换为全仓

    // ex.IO("trade_super_margin");
    //减少k线柱子的获取量，降低延迟
    ex.SetMaxBarLen(50);

    _G(coin + "pinManyTime",1600000000);
    _G(coin + "pinShortTime",1600000000);

    //对于新增的币，但是没点重置数据，需要再刷一次初始参数
    //随便取个参数，看存不存在，存在就说明已经初始化过了
    var tmp = _G(coin + "manyProfitRatio");
    if (IS_RESET || !tmp) {

        //该币种
        //多头最大浮亏金额
        _G(coin + "maxManyLostProfit", 0);
        //多头持仓状态0为空仓，1为持仓
        _G(coin + "manyStatus", 0);
        //多头止盈比例
        _G(coin + "manyProfitRatio", INIT_PROFIT_RATIO);
        //多头动态降低止盈比例次数
        _G(coin + "manyProfitRatioCount", 0);
        //多头仓位保证金
        _G(coin + "manyPosBond", 0);
        //多头浮盈比例
        _G(coin + "manyProfit", 0);
        //多头保证金占总金额比例
        _G(coin + "manyPosBondRatio", 0);
        //多头补仓比例
        _G(coin + "replenishmentManyRatio", INIT_REPLENISHMENT_RATIO);
        //多头动态提高补仓比例次数
        _G(coin + "replenishmentManyCount", 0);
        //多头贪心止盈下限比例
        _G(coin + "manyGreedyProfitRatioDown", 0);
        //多头贪心止盈上线比例
        _G(coin + "manyGreedyProfitRatioUp", 0);
        //多头贪心止盈状态 0未处于贪心中，1处于
        _G(coin + "manyGreedyStatus", 0);
        //多头持仓均价
        _G(coin + "manyPrice", 0);
        //多头持仓数量
        _G(coin + "manyPosNum", 0);
        //多头插针状态，0未插针，1已插针
        _G(coin + "pinManyStatus", 0);
        //停止多单
        _G(coin + "manyStopBuy",0);


        //空头
        _G(coin + "maxShortLostProfit", 0);
        _G(coin + "shortStatus", 0);
        _G(coin + "shortProfitRatio", INIT_PROFIT_RATIO);
        _G(coin + "shortProfitRatioCount", 0);
        _G(coin + "shortPosBond", 0);
        _G(coin + "shortProfit", 0);
        _G(coin + "shortPosBondRatio", 0);
        _G(coin + "replenishmentShortRatio", INIT_REPLENISHMENT_RATIO);
        _G(coin + "replenishmentShortCount", 0);
        _G(coin + "shortGreedyProfitRatioDown", 0);
        _G(coin + "shortGreedyProfitRatioUp", 0);
        _G(coin + "shortGreedyStatus", 0);
        _G(coin + "shortPrice", 0);
        _G(coin + "shortPosNum", 0);
        _G(coin + "pinShortStatus", 0);
        _G(coin + "shortStopBuy",0);


        //均线交叉状态
        _G(coin + "crossStatus", 0);
        //rsi状态
        _G(coin + "rsiSuper",0);
        //rsiPin状态
        _G(coin + "rsiSuperPin",0);

        //该币种手续费
        _G(coin + "charge",0);
        //初始化币种交易所标记价格
        _G(coin + "tickerLast",0);

        _G(coin + "lockPosStatus",0);

        if (!IS_HUICHE) {
            var initstatisticSql = "INSERT INTO DETAIL_STATISTIC_RECORD "
                    + "(COIN,PROFIT,SERVICECHARGE,"
                    + "VOLATILITY0,VOLATILITY1,VOLATILITY2,VOLATILITY3,VOLATILITY4,"
                    + "VOLATILITY5,VOLATILITY6,VOLATILITY7,VOLATILITY8,VOLATILITY9,"
                    + "VOLATILITY10,VOLATILITY11,VOLATILITY12,VOLATILITY13,VOLATILITY14,"
                    + "VOLATILITY15,VOLATILITY16,VOLATILITY17,VOLATILITY18,VOLATILITY19,"
                    + "VOLATILITY20,VOLATILITY21,VOLATILITY22,VOLATILITY23,VOLATILITY24,"
                    + "VOLATILITY25,VOLATILITY26,VOLATILITY27,VOLATILITY28,VOLATILITY29)"
                    + " VALUES ('" + coin + "'," + 0 + "," + 0 +","
                    + "'','','','','','','','','','',"
                    + "'','','','','','','','','','',"
                    + "'','','','','','','','','','')";
            DBExec(initstatisticSql);
        }
    }

    //初始化当前币种k线交叉趋势
    getCross(ex, PERIOD);

    //更新价格精度
    updatePricePrecision(ex);
    //更新数量精度
    var quantityPrecision = 0;
    var minQuantity = parseFloat(getMinQuantity(ex));
    var b = minQuantity.toString();
    if (b.indexOf(".") != -1) {
        var c = b.split(".");
        quantityPrecision = c[1].length;
    }
    _G(coin + "quantityPrecision", quantityPrecision);
    ex.SetPrecision(_G(coin + "pricePrecision"), quantityPrecision);
    Log("设置" + coin + "精度", _G(coin + "pricePrecision"), quantityPrecision);
}

//分析币种性能，包括近期振幅
function analysisCoin(ex) {
    //获取1分钟k线，数组长度大概2000

    //分析每根线的高开低收，记录涨幅和跌幅

    //

}

function main() {
    STOP_ROBOT_STATUS = false;
    CLOSE_BUY = false;
    NIGTH_MODE = false;
    //总金额

    if (IS_RESET) {
        _G(null);
        LogReset(1);
        LogProfitReset();
        LogVacuum();
        _G("startTime", Unix());
        _G("usdtTransfer",usdtTransfer);

        if (IS_OPEN_SIMULATED_FUNDS) {
            _G("simulatedEq", INIT_SIMULATED_FUNDS);
        }


        if (!IS_HUICHE) {
            var dropSql = "DROP TABLE IF EXISTS DETAIL_TRANSACTION_RECORD;";
            DBExec(dropSql);
            //记录收益详细记录
            //币种，方向，起始时间，结束时间，起始下单价格，最终下单价格，持仓均价，成交时标记价格，波动率，仓位保证金，收益/%
            var createSql = [
                "CREATE TABLE DETAIL_TRANSACTION_RECORD(",
                "COIN TEXT NOT NULL,",
                "DIRECTION TEXT NOT NULL,",
                "STARTTIME TEXT NOT NULL,",
                "ENDTIME TEXT NOT NULL,",
                "STARTPRICE REAL NOT NULL,",
                "ENDPRICE REAL NOT NULL,",
                "AVERAGEPRICE REAL NOT NULL,",
                "CLOSEPOSPRICE REAL NOT NULL,",
                "MAXSHORTLOSTPROFIT TEXT NOT NULL,",
                "VOLATILITY TEXT NOT NULL,",
                "BOND REAL NOT NULL,",
                "PROFIT REAL NOT NULL)"
            ].join("");
            DBExec(createSql);


            var dropSql1 = "DROP TABLE IF EXISTS DETAIL_STATISTIC_RECORD;";
            DBExec(dropSql1);
            //创建统计库 字段--币种，收益，手续费，0-29共30个区间 ，每个档次存储次数|收益
            var createSql1 = [
                "CREATE TABLE DETAIL_STATISTIC_RECORD(",
                "COIN TEXT NOT NULL,",
                "PROFIT REAL NOT NULL,",
                "SERVICECHARGE REAL NOT NULL,",
                "VOLATILITY0 TEXT,",
                "VOLATILITY1 TEXT,",
                "VOLATILITY2 TEXT,",
                "VOLATILITY3 TEXT,",
                "VOLATILITY4 TEXT,",
                "VOLATILITY5 TEXT,",
                "VOLATILITY6 TEXT,",
                "VOLATILITY7 TEXT,",
                "VOLATILITY8 TEXT,",
                "VOLATILITY9 TEXT,",
                "VOLATILITY10 TEXT,",
                "VOLATILITY11 TEXT,",
                "VOLATILITY12 TEXT,",
                "VOLATILITY13 TEXT,",
                "VOLATILITY14 TEXT,",
                "VOLATILITY15 TEXT,",
                "VOLATILITY16 TEXT,",
                "VOLATILITY17 TEXT,",
                "VOLATILITY18 TEXT,",
                "VOLATILITY19 TEXT,",
                "VOLATILITY20 TEXT,",
                "VOLATILITY21 TEXT,",
                "VOLATILITY22 TEXT,",
                "VOLATILITY23 TEXT,",
                "VOLATILITY24 TEXT,",
                "VOLATILITY25 TEXT,",
                "VOLATILITY26 TEXT,",
                "VOLATILITY27 TEXT,",
                "VOLATILITY28 TEXT,",
                "VOLATILITY29 TEXT)"
            ].join("");

            DBExec(createSql1);


        }
        Log("重置所有数据", "#FF0000");
    }

    //设置k线周期
    if (K_LINE_PERIOD == 0) {
        PERIOD = PERIOD_M1;
    } else if (K_LINE_PERIOD == 1) {
        PERIOD = PERIOD_M5;
    } else if (K_LINE_PERIOD == 2) {
        PERIOD = PERIOD_M15;
    } else if (K_LINE_PERIOD == 3) {
        PERIOD = PERIOD_M30;
    } else if (K_LINE_PERIOD == 4) {
        PERIOD = PERIOD_H1;
        PERIOD_TYPE = 1;
    } else if (K_LINE_PERIOD == 5) {
        PERIOD = PERIOD_D1;
        PERIOD_TYPE = 2;
    }
    //多交易所
    for (var i = 0; i < exchanges.length; i++) {
        initData(exchanges[i]);
    }
    var currTotalEq = getTotalEquity();
    if (IS_RESET) {
        _G("available_funds", currTotalEq);
    }
    Log("以下错误代码---Futures_OP 4: 400: {code:-4046,msg:No need to change margin type是正常情况", "#FF0000");
    if (totalEq == -1) {
        var initEq = _G("initEq");
        if (!initEq) {
            if (currTotalEq) {
                totalEq = currTotalEq;
                _G("initEq", currTotalEq);
            } else {
                throw "获取初始权益失败"
            }
        } else {
            totalEq = initEq
        }
    }
    //初始化参数
    INIT_BUY_PROPORTION = 6/totalEq/MARGIN_LEVEL * ORDER_MULTIPLE;
    FIRST_BUY_PROPORTION = INIT_BUY_PROPORTION * FIRST_BUY_MULTIPLE;
    // INIT_BUY_PROPORTION = 0.0003;
    //每个模式分为固定和自适应，提示上写明各个档位承受的波动值
    //默认固定,保证金加到30%时大约币种波动为7.7%不回调1.4%    5.87
    if (INIT_MODE == 0) {
        INIT_PROFIT_RATIO = 0.004;
        INIT_REPLENISHMENT_RATIO = 0.01;
        IS_OPEN_PROFIT = false;
        IS_OPEN_REPLENISHMENT_RATIO = false;
        POS_PROFIT_LOSS_RATIO = POS_BOND_LOSS_RATIO * 0.2;
        //默认自适应1 保证金加到30%时大约币种波动9.2%不会调1.4%-1.87%
    } else if (INIT_MODE == 1) {
        INIT_PROFIT_RATIO = 0.004;
        INIT_REPLENISHMENT_RATIO = 0.01;
        IS_OPEN_PROFIT = true;
        //计算触发动态补仓动态止盈的保证金
        var bond = INIT_BUY_PROPORTION * totalEq * 27;
        var bondRatioStr = _N(bond/totalEq * 100,3).toString();
        JUDGE_DYNAMIC_PROFIT_RATIO = bondRatioStr;
        PROFIT_STEP = -0.0005;
        IS_OPEN_REPLENISHMENT_RATIO = true;
        JUDGE_DYNAMIC_REPLENISHMENT_RATIO = bondRatioStr;
        REPLENISHMENT_STEP = 0.005;
        POS_PROFIT_LOSS_RATIO = POS_BOND_LOSS_RATIO * 0.3;
        //默认自适应2 保证金加到30%时大约币种波动10%不会调1.4%-2.34%
    } else if (INIT_MODE == 2) {
        INIT_PROFIT_RATIO = 0.004;
        INIT_REPLENISHMENT_RATIO = 0.01;
        IS_OPEN_PROFIT = true;
        //计算触发动态补仓动态止盈的保证金
        var bond1 = INIT_BUY_PROPORTION * totalEq * 18;
        var bondRatio1 = _N(bond1/totalEq * 100,3);
        var bond2 = INIT_BUY_PROPORTION * totalEq * 123;
        var bondRatio2 = _N(bond2/totalEq * 100,3);
        var bondRatioStr = bondRatio1.toString() + "," + bondRatio2.toString();
        JUDGE_DYNAMIC_PROFIT_RATIO = bondRatioStr;
        PROFIT_STEP = -0.0005;
        IS_OPEN_REPLENISHMENT_RATIO = true;
        JUDGE_DYNAMIC_REPLENISHMENT_RATIO = bondRatioStr;
        REPLENISHMENT_STEP = 0.005;
        POS_PROFIT_LOSS_RATIO = POS_BOND_LOSS_RATIO * 0.4;
        //激进固定保证金加到30%时大约币种波动为5.5%不回调1.1%
    } else if (INIT_MODE == 3) {
        INIT_PROFIT_RATIO = 0.004;
        INIT_REPLENISHMENT_RATIO = 0.007;
        IS_OPEN_PROFIT = false;
        IS_OPEN_REPLENISHMENT_RATIO = false;
        POS_PROFIT_LOSS_RATIO = POS_BOND_LOSS_RATIO * 0.14;
        //激进自适应 保证金加到30%时大约币种波动7.5%不会调1.1%-1.8%
    } else if (INIT_MODE == 4) {
        INIT_PROFIT_RATIO = 0.004;
        INIT_REPLENISHMENT_RATIO = 0.007;
        IS_OPEN_PROFIT = true;
        //计算触发动态补仓动态止盈的保证金
        var bond1 = INIT_BUY_PROPORTION * totalEq * 23;
        var bondRatio1 = _N(bond1/totalEq * 100,3);
        var bond2 = INIT_BUY_PROPORTION * totalEq * 183;
        var bondRatio2 = _N(bond2/totalEq * 100,3);
        var bondRatioStr = bondRatio1.toString() + "," + bondRatio2.toString();
        JUDGE_DYNAMIC_PROFIT_RATIO = bondRatioStr;
        PROFIT_STEP = -0.0005;
        IS_OPEN_REPLENISHMENT_RATIO = true;
        JUDGE_DYNAMIC_REPLENISHMENT_RATIO = bondRatioStr;
        REPLENISHMENT_STEP = 0.004;
        POS_PROFIT_LOSS_RATIO = POS_BOND_LOSS_RATIO * 0.3;
        //保守固定保证金加到30%时大约币种波动为10.5%不回调2.03%
    } else if (INIT_MODE == 5) {
        INIT_PROFIT_RATIO = 0.005;
        INIT_REPLENISHMENT_RATIO = 0.015;
        IS_OPEN_PROFIT = false;
        IS_OPEN_REPLENISHMENT_RATIO = false;
        POS_PROFIT_LOSS_RATIO = POS_BOND_LOSS_RATIO * 0.3;
        PIN_RATIO = 0.76;
        //保守自适应保证金加到30%时大约币种波动为12.5%不回调2.03-2.44%
    } else if (INIT_MODE == 6) {
        NIT_PROFIT_RATIO = 0.005;
        INIT_REPLENISHMENT_RATIO = 0.015;
        IS_OPEN_PROFIT = true;
        //计算触发动态补仓动态止盈的保证金
        var bond = INIT_BUY_PROPORTION * totalEq * 16;
        var bondRatioStr = _N(bond/totalEq * 100,3).toString();
        JUDGE_DYNAMIC_PROFIT_RATIO = bondRatioStr;
        PROFIT_STEP = -0.001;
        IS_OPEN_REPLENISHMENT_RATIO = true;
        JUDGE_DYNAMIC_REPLENISHMENT_RATIO = bondRatioStr;
        REPLENISHMENT_STEP = 0.005;
        POS_PROFIT_LOSS_RATIO = POS_BOND_LOSS_RATIO * 0.4;

        PIN_RATIO = 0.76;
        //保守固定保证金加到30%时大约币种波动为13.8%不回调2.55%
    } else if (INIT_MODE == 7) {
        INIT_PROFIT_RATIO = 0.005;
        INIT_REPLENISHMENT_RATIO = 0.02;
        IS_OPEN_PROFIT = false;
        IS_OPEN_REPLENISHMENT_RATIO = false;
        POS_PROFIT_LOSS_RATIO = POS_BOND_LOSS_RATIO * 0.4;
        //保守固定保证金加到30%时大约币种波动为16.8%不回调3.07%
    } else if (INIT_MODE == 8) {
        INIT_PROFIT_RATIO = 0.005;
        INIT_REPLENISHMENT_RATIO = 0.025;
        IS_OPEN_PROFIT = false;
        IS_OPEN_REPLENISHMENT_RATIO = false;
        POS_PROFIT_LOSS_RATIO = POS_BOND_LOSS_RATIO * 0.5;
        //保守固定保证金加到30%时大约币种波动为19.5%不回调3.6%
    } else if (INIT_MODE == 9) {
        INIT_PROFIT_RATIO = 0.005;
        INIT_REPLENISHMENT_RATIO = 0.03;
        IS_OPEN_PROFIT = false;
        IS_OPEN_REPLENISHMENT_RATIO = false;
        POS_PROFIT_LOSS_RATIO = POS_BOND_LOSS_RATIO * 0.6;
    } else if (INIT_MODE == 10) {
        INIT_PROFIT_RATIO = 0.005;
        INIT_REPLENISHMENT_RATIO = 0.04;
        IS_OPEN_PROFIT = false;
        IS_OPEN_REPLENISHMENT_RATIO = false;
        POS_PROFIT_LOSS_RATIO = POS_BOND_LOSS_RATIO * 0.8;
    } else if (INIT_MODE == 11) {
        INIT_PROFIT_RATIO = 0.005;
        INIT_REPLENISHMENT_RATIO = 0.05;
        IS_OPEN_PROFIT = false;
        IS_OPEN_REPLENISHMENT_RATIO = false;
        POS_PROFIT_LOSS_RATIO = POS_BOND_LOSS_RATIO * 1;
    }


    //初始化根据保证金止损的阈值
    if (COMPOUND_INTEREST) {
        POS_BOND_LOSS = currTotalEq * POS_BOND_LOSS_RATIO;
        POS_PROFIT_LOSS = currTotalEq * POS_PROFIT_LOSS_RATIO;
    } else {
        POS_BOND_LOSS = totalEq * POS_BOND_LOSS_RATIO;
        POS_PROFIT_LOSS = totalEq * POS_PROFIT_LOSS_RATIO;
    }
    Log(totalEq);
    _G("loopDelay","0ms");
    _CDelay(500);
    while (true) {
        var beginTime = +new Date();
        //记录程序运行时间
        updateRunTime();
        updateTable();
        for (var j = 0; j < exchanges.length; j++) {
            onTick(exchanges[j]);
            Sleep(DELAY);
        }
        //非模拟资金自动划转
        if (!IS_OPEN_SIMULATED_FUNDS && !IS_HUICHE && OPRN_FUTURES_TRANSFER) {
            var available_funds = _G("available_funds");
            var eq = available_funds - FUTURES_TRANSFER_THRESHOLD;
            if (available_funds >= FUTURES_TRANSFER_THRESHOLD && eq >= 10) {
                usdtTransfer("USDT", eq, 2);
            }
        }
        handleCMD();
        var endTime = +new Date();
        _G("loopDelay",(endTime-beginTime)+"ms");
        //关机
        if (STOP_ROBOT_STATUS) {
            break;
        }
    }
}
