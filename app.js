/* ==================================================
   ĐẦU TƯ CỔ TỨC
   APP.JS
================================================== */

const STORAGE_KEY = "dividendInvestmentApp";

const defaultData = {
    deposits: [],
    transactions: [],
    dividends: [],

    settings: {
        fee: 0.15,
        custody: 0.4,
        interest: 4,
        custodyEnabled: false
    }
};

let data = loadData();

/* ==================================================
   STORAGE
================================================== */

function loadData() {

    try {

        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) {
            return structuredClone(defaultData);
        }

        const parsed = JSON.parse(saved);

        return {
            deposits: parsed.deposits || [],
            transactions: parsed.transactions || [],
            dividends: parsed.dividends || [],
            settings: {
                ...defaultData.settings,
                ...(parsed.settings || {})
            }
        };

    } catch (error) {

        console.error(error);

        return structuredClone(defaultData);
    }
}

function saveData() {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
    );
}

/* ==================================================
   UTILS
================================================== */

function money(value) {

    return Number(value || 0).toLocaleString(
        "vi-VN"
    ) + " đ";
}

function number(value) {

    return Number(value || 0);
}

function today() {

    return new Date()
        .toISOString()
        .slice(0, 10);
}

function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function showToast(message) {

    const toast =
        document.getElementById("toast");

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

/* ==================================================
   TÍNH TIỀN
================================================== */

function totalDeposited() {

    return data.deposits.reduce(
        (sum, item) =>
            sum + number(item.amount),
        0
    );
}

function totalBuyValue() {

    return data.transactions
        .filter(t => t.type === "buy")
        .reduce(
            (sum, t) =>
                sum +
                number(t.qty) *
                number(t.price) +
                number(t.fee),
            0
        );
}

function totalSellValue() {

    return data.transactions
        .filter(t => t.type === "sell")
        .reduce(
            (sum, t) =>
                sum +
                number(t.qty) *
                number(t.price) -
                number(t.fee),
            0
        );
}

function totalCashDividends() {

    return data.dividends
        .filter(d => d.type === "cash")
        .reduce(
            (sum, d) =>
                sum +
                number(d.cashReceived),
            0
        );
}

function totalDividendWallet() {

    return totalCashDividends() -
        data.transactions
            .filter(t =>
                t.type === "buy" &&
                t.source === "dividend"
            )
            .reduce(
                (sum, t) =>
                    sum +
                    number(t.totalCost),
                0
            );
}

function cashBalance() {

    const deposited = totalDeposited();

    const buysFromCash =
        data.transactions
            .filter(t =>
                t.type === "buy" &&
                t.source === "cash"
            )
            .reduce(
                (sum, t) =>
                    sum +
                    number(t.totalCost),
                0
            );

    const sells =
        totalSellValue();

    const cashDividends =
        totalCashDividends();

    const dividendUsed =
        data.transactions
            .filter(t =>
                t.type === "buy" &&
                t.source === "dividend"
            )
            .reduce(
                (sum, t) =>
                    sum +
                    number(t.totalCost),
                0
            );

    /*
      Cổ tức dùng mua CP lấy từ ví cổ tức,
      không được trừ lần nữa khỏi tiền mặt.
    */

    return Math.max(
        0,
        deposited
        - buysFromCash
        + sells
    );
}

/* ==================================================
   CỔ PHIẾU
================================================== */

function buildPortfolio() {

    const portfolio = {};

    data.transactions.forEach(t => {

        const symbol =
            String(t.symbol || "")
                .trim()
                .toUpperCase();

        if (!symbol) return;

        if (!portfolio[symbol]) {

            portfolio[symbol] = {
                qty: 0,
                cost: 0
            };
        }

        if (t.type === "buy") {

            portfolio[symbol].qty +=
                number(t.qty);

            portfolio[symbol].cost +=
                number(t.totalCost);

        }

        if (t.type === "sell") {

            portfolio[symbol].qty -=
                number(t.qty);

            if (portfolio[symbol].qty < 0) {
                portfolio[symbol].qty = 0;
            }
        }

    });

    /*
      Cổ tức bằng cổ phiếu
    */

    data.dividends.forEach(d => {

        if (
            d.type !== "stock" &&
            d.type !== "bonus"
        ) return;

        const symbol =
            String(d.symbol || "")
                .trim()
                .toUpperCase();

        if (!portfolio[symbol]) {

            portfolio[symbol] = {
                qty: 0,
                cost: 0
            };
        }

        portfolio[symbol].qty +=
            number(d.sharesReceived);

    });

    return portfolio;
}

/* ==================================================
   DASHBOARD
================================================== */

function renderDashboard() {

    const portfolio =
        buildPortfolio();

    const shareCapital =
        Object.values(portfolio)
            .reduce(
                (sum, item) =>
                    sum +
                    number(item.cost),
                0
            );

    const cash =
        cashBalance();

    const dividendWallet =
        totalDividendWallet();

    const totalValue =
        cash +
        dividendWallet +
        shareCapital;

    document.getElementById(
        "dashboardCards"
    ).innerHTML = `

        <div class="stat">
            <div class="label">
                Tổng tiền nạp
            </div>
            <div class="value">
                ${money(totalDeposited())}
            </div>
        </div>

        <div class="stat">
            <div class="label">
                Tiền mặt
            </div>
            <div class="value">
                ${money(cash)}
            </div>
        </div>

        <div class="stat">
            <div class="label">
                Ví cổ tức
            </div>
            <div class="value">
                ${money(dividendWallet)}
            </div>
        </div>

        <div class="stat">
            <div class="label">
                Tổng giá trị
            </div>
            <div class="value">
                ${money(totalValue)}
            </div>
        </div>

        <div class="stat">
            <div class="label">
                Vốn cổ phiếu
            </div>
            <div class="value">
                ${money(shareCapital)}
            </div>
        </div>

        <div class="stat">
            <div class="label">
                Cổ tức tiền mặt
            </div>
            <div class="value">
                ${money(totalCashDividends())}
            </div>
        </div>

        <div class="stat">
            <div class="label">
                Số mã cổ phiếu
            </div>
            <div class="value">
                ${Object.keys(portfolio).length}
            </div>
        </div>

        <div class="stat">
            <div class="label">
                Tổng giao dịch
            </div>
            <div class="value">
                ${data.transactions.length}
            </div>
        </div>
    `;

    renderPortfolio();
    renderDeposits();
    renderRecent();
}

/* ==================================================
   PORTFOLIO
================================================== */

function renderPortfolio() {

    const container =
        document.getElementById("portfolio");

    const portfolio =
        buildPortfolio();

    const symbols =
        Object.keys(portfolio)
            .filter(symbol =>
                portfolio[symbol].qty > 0
            );

    if (!symbols.length) {

        container.innerHTML = `
            <div class="card">
                Chưa có cổ phiếu.
            </div>
        `;

        return;
    }

    container.innerHTML =
        symbols.map(symbol => {

            const item =
                portfolio[symbol];

            return `

                <div class="card stock-card">

                    <h3>
                        ${escapeHTML(symbol)}
                    </h3>

                    <div class="stock-meta">

                        <div class="kv">
                            <span>Số lượng</span>
                            <strong>
                                ${item.qty.toLocaleString("vi-VN")}
                            </strong>
                        </div>

                        <div class="kv">
                            <span>Vốn</span>
                            <strong>
                                ${money(item.cost)}
                            </strong>
                        </div>

                        <div class="kv">
                            <span>Giá vốn TB</span>
                            <strong>
                                ${
                                    item.qty > 0
                                    ? money(
                                        item.cost /
                                        item.qty
                                    )
                                    : money(0)
                                }
                            </strong>
                        </div>

                    </div>

                </div>
            `;

        }).join("");
}

/* ==================================================
   NẠP TIỀN
================================================== */

function handleDeposit(event) {

    event.preventDefault();

    const form =
        event.target;

    const fd =
        new FormData(form);

    const amount =
        number(fd.get("amount"));

    if (amount <= 0) {

        showToast(
            "Số tiền nạp phải lớn hơn 0"
        );

        return;
    }

    const deposit = {

        id:
            Date.now(),

        date:
            fd.get("date") || today(),

        amount,

        source:
            fd.get("source") || "",

        note:
            fd.get("note") || "",

        createdAt:
            new Date().toISOString()
    };

    data.deposits.push(deposit);

    saveData();

    form.reset();

    document.getElementById(
        "depositDate"
    ).value = today();

    renderAll();

    showToast(
        `Đã nạp ${money(amount)} vào tiền mặt`
    );
}

function renderDeposits() {

    const history =
        document.getElementById(
            "depositHistory"
        );

    const summary =
        document.getElementById(
            "depositSummary"
        );

    const deposits =
        [...data.deposits]
            .sort(
                (a, b) =>
                    new Date(b.date) -
                    new Date(a.date)
            );

    summary.innerHTML = `

        <div class="deposit-summary">

            <div class="deposit-stat">
                <span>Tổng tiền đã nạp</span>
                <strong>
                    ${money(totalDeposited())}
                </strong>
            </div>

            <div class="deposit-stat">
                <span>Số lần nạp</span>
                <strong>
                    ${deposits.length}
                </strong>
            </div>

            <div class="deposit-stat">
                <span>Tiền mặt hiện tại</span>
                <strong>
                    ${money(cashBalance())}
                </strong>
            </div>

        </div>
    `;

    if (!deposits.length) {

        history.innerHTML = `
            <div class="card">
                Chưa có lần nạp tiền nào.
            </div>
        `;

        return;
    }

    history.innerHTML =
        deposits.map(d => `

            <div class="deposit-card">

                <h3>
                    + ${money(d.amount)}
                </h3>

                <div class="deposit-meta">

                    <div>
                        <span>Ngày</span>
                        <strong>
                            ${escapeHTML(d.date)}
                        </strong>
                    </div>

                    <div>
                        <span>Nguồn</span>
                        <strong>
                            ${
                                escapeHTML(
                                    d.source ||
                                    "Không ghi"
                                )
                            }
                        </strong>
                    </div>

                    <div>
                        <span>Ghi chú</span>
                        <strong>
                            ${
                                escapeHTML(
                                    d.note ||
                                    "—"
                                )
                            }
                        </strong>
                    </div>

                </div>

                <button
                    class="danger deposit-delete"
                    onclick="deleteDeposit(${d.id})"
                >
                    Xóa lần nạp
                </button>

            </div>

        `).join("");
}

function deleteDeposit(id) {

    const deposit =
        data.deposits.find(
            d => d.id === id
        );

    if (!deposit) return;

    /*
      Không cho xóa nếu số tiền đã được
      sử dụng khiến tiền mặt bị âm.
    */

    const before =
        cashBalance();

    if (
        before <
        number(deposit.amount)
    ) {

        showToast(
            "Không thể xóa: số tiền này đã được sử dụng."
        );

        return;
    }

    if (
        !confirm(
            "Bạn có chắc muốn xóa lần nạp này?"
        )
    ) return;

    data.deposits =
        data.deposits.filter(
            d => d.id !== id
        );

    saveData();

    renderAll();

    showToast("Đã xóa lần nạp");
}

/* ==================================================
   GIAO DỊCH
================================================== */

function handleTrade(event) {

    event.preventDefault();

    const form =
        event.target;

    const fd =
        new FormData(form);

    const type =
        fd.get("type");

    const source =
        fd.get("source");

    const symbol =
        String(fd.get("symbol") || "")
            .trim()
            .toUpperCase();

    const qty =
        number(fd.get("qty"));

    const price =
        number(fd.get("price"));

    const gross =
        qty * price;

    const feeRate =
        number(data.settings.fee) / 100;

    const fee =
        gross * feeRate;

    const totalCost =
        type === "buy"
        ? gross + fee
        : gross - fee;

    if (!symbol || qty <= 0 || price < 0) {

        showToast(
            "Thông tin giao dịch không hợp lệ"
        );

        return;
    }

    if (type === "buy") {

        if (source === "cash") {

            if (
                cashBalance() <
                totalCost
            ) {

                showToast(
                    "Không đủ tiền mặt để mua"
                );

                return;
            }

        }

        if (source === "dividend") {

            if (
                totalDividendWallet() <
                totalCost
            ) {

                showToast(
                    "Không đủ tiền trong ví cổ tức"
                );

                return;
            }
        }
    }

    if (type === "sell") {

        const portfolio =
            buildPortfolio();

        const owned =
            portfolio[symbol]?.qty || 0;

        if (owned < qty) {

            showToast(
                `Không đủ ${symbol} để bán`
            );

            return;
        }
    }

    data.transactions.push({

        id:
            Date.now(),

        type,

        date:
            fd.get("date") || today(),

        symbol,

        qty,

        price,

        source:
            type === "buy"
            ? source
            : "cash",

        gross,

        fee,

        totalCost,

        note:
            fd.get("note") || "",

        createdAt:
            new Date().toISOString()
    });

    saveData();

    form.reset();

    renderAll();

    showToast(
        type === "buy"
        ? "Đã lưu giao dịch mua"
        : "Đã lưu giao dịch bán"
    );
}

function renderTransactions() {

    const container =
        document.getElementById(
            "transactions"
        );

    const list =
        [...data.transactions]
            .sort(
                (a, b) =>
                    new Date(b.date) -
                    new Date(a.date)
            );

    if (!list.length) {

        container.innerHTML = `
            <div class="card">
                Chưa có giao dịch.
            </div>
        `;

        return;
    }

    container.innerHTML = `

        <div class="table-scroll">

            <table>

                <thead>

                    <tr>
                        <th>Ngày</th>
                        <th>Loại</th>
                        <th>Mã</th>
                        <th>SL</th>
                        <th>Giá</th>
                        <th>Phí</th>
                        <th>Tổng</th>
                        <th>Nguồn</th>
                        <th></th>
                    </tr>

                </thead>

                <tbody>

                    ${list.map(t => `

                        <tr>

                            <td>
                                ${escapeHTML(t.date)}
                            </td>

                            <td class="${
                                t.type === "buy"
                                ? "green"
                                : "red"
                            }">

                                ${
                                    t.type === "buy"
                                    ? "Mua"
                                    : "Bán"
                                }

                            </td>

                            <td>
                                ${escapeHTML(t.symbol)}
                            </td>

                            <td>
                                ${t.qty.toLocaleString("vi-VN")}
                            </td>

                            <td>
                                ${money(t.price)}
                            </td>

                            <td>
                                ${money(t.fee)}
                            </td>

                            <td>
                                ${money(t.totalCost)}
                            </td>

                            <td>
                                ${
                                    t.source === "dividend"
                                    ? "Ví cổ tức"
                                    : "Tiền mặt"
                                }
                            </td>

                            <td>
                                <button
                                    class="action"
                                    onclick="deleteTransaction(${t.id})"
                                >
                                    Xóa
                                </button>
                            </td>

                        </tr>

                    `).join("")}

                </tbody>

            </table>

        </div>
    `;
}

function deleteTransaction(id) {

    if (
        !confirm(
            "Xóa giao dịch này?"
        )
    ) return;

    data.transactions =
        data.transactions.filter(
            t => t.id !== id
        );

    saveData();

    renderAll();

    showToast(
        "Đã xóa giao dịch"
    );
}

/* ==================================================
   CỔ TỨC
================================================== */

function handleDividend(event) {

    event.preventDefault();

    const form =
        event.target;

    const fd =
        new FormData(form);

    const symbol =
        String(fd.get("symbol") || "")
            .trim()
            .toUpperCase();

    const type =
        fd.get("type");

    const portfolio =
        buildPortfolio();

    const owned =
        portfolio[symbol]?.qty || 0;

    if (owned <= 0) {

        showToast(
            `Chưa có cổ phiếu ${symbol}`
        );

        return;
    }

    const dividend = {

        id:
            Date.now(),

        symbol,

        type,

        recordDate:
            fd.get("recordDate"),

        payDate:
            fd.get("payDate"),

        cashPerShare:
            number(
                fd.get("cashPerShare")
            ),

        sharesReceived: 0,

        cashReceived: 0,

        note:
            fd.get("note") || "",

        createdAt:
            new Date().toISOString()
    };

    if (type === "cash") {

        dividend.cashReceived =
            owned *
            dividend.cashPerShare;
    }

    if (
        type === "stock" ||
        type === "bonus"
    ) {

        const base =
            number(
                fd.get("ratioBase")
            );

        const newShares =
            number(
                fd.get("ratioNew")
            );

        if (base <= 0) {

            showToast(
                "Tỷ lệ cổ phiếu không hợp lệ"
            );

            return;
        }

        dividend.sharesReceived =
            Math.floor(
                owned *
                newShares /
                base
            );
    }

    data.dividends.push(
        dividend
    );

    saveData();

    form.reset();

    renderAll();

    showToast(
        "Đã lưu cổ tức"
    );
}

function renderDividends() {

    const container =
        document.getElementById(
            "dividends"
        );

    const list =
        [...data.dividends]
            .sort(
                (a, b) =>
                    new Date(b.payDate) -
                    new Date(a.payDate)
            );

    if (!list.length) {

        container.innerHTML = `
            <div class="card">
                Chưa có cổ tức.
            </div>
        `;

        return;
    }

    container.innerHTML = `

        <div class="table-scroll">

            <table>

                <thead>

                    <tr>
                        <th>Mã</th>
                        <th>Loại</th>
                        <th>Chốt quyền</th>
                        <th>Ngày nhận</th>
                        <th>Cổ tức tiền</th>
                        <th>CP nhận</th>
                        <th></th>
                    </tr>

                </thead>

                <tbody>

                    ${list.map(d => `

                        <tr>

                            <td>
                                ${escapeHTML(d.symbol)}
                            </td>

                            <td>
                                ${
                                    d.type === "cash"
                                    ? "Tiền mặt"
                                    : d.type === "stock"
                                    ? "Cổ phiếu"
                                    : "CP thưởng"
                                }
                            </td>

                            <td>
                                ${escapeHTML(d.recordDate)}
                            </td>

                            <td>
                                ${escapeHTML(d.payDate)}
                            </td>

                            <td>
                                ${money(d.cashReceived)}
                            </td>

                            <td>
                                ${number(
                                    d.sharesReceived
                                ).toLocaleString("vi-VN")}
                            </td>

                            <td>

                                <button
                                    class="action"
                                    onclick="deleteDividend(${d.id})"
                                >
                                    Xóa
                                </button>

                            </td>

                        </tr>

                    `).join("")}

                </tbody>

            </table>

        </div>
    `;
}

function deleteDividend(id) {

    if (
        !confirm(
            "Xóa cổ tức này?"
        )
    ) return;

    data.dividends =
        data.dividends.filter(
            d => d.id !== id
        );

    saveData();

    renderAll();

    showToast(
        "Đã xóa cổ tức"
    );
}

/* ==================================================
   RECENT
================================================== */

function renderRecent() {

    const container =
        document.getElementById(
            "recent"
        );

    const list =
        [...data.transactions]
            .sort(
                (a, b) =>
                    new Date(b.date) -
                    new Date(a.date)
            )
            .slice(0, 10);

    if (!list.length) {

        container.innerHTML = `
            <div class="card">
                Chưa có giao dịch.
            </div>
        `;

        return;
    }

    container.innerHTML =
        list.map(t => `

            <div class="card"
                 style="margin-bottom:10px">

                <strong>
                    ${
                        t.type === "buy"
                        ? "Mua"
                        : "Bán"
                    }
                    ${escapeHTML(t.symbol)}
                </strong>

                <p>
                    ${t.qty.toLocaleString("vi-VN")}
                    CP ×
                    ${money(t.price)}
                    =
                    ${money(t.totalCost)}
                </p>

                <span class="${
                    t.type === "buy"
                    ? "green"
                    : "red"
                }">
                    ${escapeHTML(t.date)}
                </span>

            </div>

        `).join("");
}

/* ==================================================
   DỰ PHÓNG
================================================== */

function getProjectionInput(id) {

    return number(
        document.getElementById(id)?.value
    );
}

function runProjection() {

    const source =
        document.getElementById(
            "projectionSource"
        ).value
            .trim()
            .toUpperCase();

    const target =
        document.getElementById(
            "projectionTarget"
        ).value
            .trim()
            .toUpperCase();

    const initialShares =
        getProjectionInput(
            "projectionShares"
        );

    const sourcePrice =
        getProjectionInput(
            "projectionSourcePrice"
        );

    const targetPrice =
        getProjectionInput(
            "projectionTargetPrice"
        );

    const monthlyMoney =
        getProjectionInput(
            "projectionMonthlyMoney"
        );

    const reinvestPercent =
        getProjectionInput(
            "projectionReinvest"
        ) / 100;

    const years =
        getProjectionInput(
            "projectionYears"
        );

    const contributionYears =
        getProjectionInput(
            "projectionContributionYears"
        );

    const reinvestYears =
        getProjectionInput(
            "projectionReinvestYears"
        );

    const sourceGrowth =
        getProjectionInput(
            "projectionSourcePriceGrowth"
        ) / 100;

    const targetGrowth =
        getProjectionInput(
            "projectionTargetPriceGrowth"
        ) / 100;

    const scenarios = {

        weak: {
            name: "🔴 Yếu",
            sourceDividend:
                getProjectionInput(
                    "sourceScenarioWeak"
                ),
            targetDividend:
                getProjectionInput(
                    "targetScenarioWeak"
                )
        },

        medium: {
            name: "🟡 Trung bình",
            sourceDividend:
                getProjectionInput(
                    "sourceScenarioMedium"
                ),
            targetDividend:
                getProjectionInput(
                    "targetScenarioMedium"
                )
        },

        high: {
            name: "🟢 Cao",
            sourceDividend:
                getProjectionInput(
                    "sourceScenarioHigh"
                ),
            targetDividend:
                getProjectionInput(
                    "targetScenarioHigh"
                )
        }
    };

    function calculate(scenario) {

        let sourceShares =
            initialShares;

        let targetShares = 0;

        let cash = 0;

        let totalContributed = 0;

        let sourcePriceNow =
            sourcePrice;

        let targetPriceNow =
            targetPrice;

        const rows = [];

        for (
            let year = 1;
            year <= years;
            year++
        ) {

            if (
                year <= contributionYears
            ) {

                totalContributed +=
                    monthlyMoney * 12;

                cash +=
                    monthlyMoney * 12;
            }

            const sourceDividendCash =
                sourceShares *
                scenario.sourceDividend;

            /*
              Cổ tức CP nguồn đi vào tiền mặt
              để tái đầu tư.
            */

            cash +=
                sourceDividendCash;

            let reinvestAmount = 0;

            let boughtTarget = 0;

            if (
                year <= reinvestYears
            ) {

                reinvestAmount =
                    cash *
                    reinvestPercent;

                boughtTarget =
                    Math.floor(
                        reinvestAmount /
                        targetPriceNow
                    );

                const spent =
                    boughtTarget *
                    targetPriceNow;

                cash -= spent;

                targetShares +=
                    boughtTarget;

                /*
                  Phần tiền lẻ không mua đủ lô
                  vẫn giữ lại trong cash.
                */
            }

            /*
              Cổ tức CP đích.
              Tách riêng khỏi CP nguồn.
            */

            const targetDividendCash =
                targetShares *
                scenario.targetDividend;

            cash +=
                targetDividendCash;

            /*
              Nếu vẫn còn thời gian tái đầu tư,
              cổ tức của CP đích cũng được dùng
              để mua thêm CP đích.
            */

            let targetDividendBuy = 0;

            if (
                year <= reinvestYears &&
                reinvestPercent > 0
            ) {

                const available =
                    targetDividendCash *
                    reinvestPercent;

                targetDividendBuy =
                    Math.floor(
                        available /
                        targetPriceNow
                    );

                const spent =
                    targetDividendBuy *
                    targetPriceNow;

                cash -= spent;

                targetShares +=
                    targetDividendBuy;
            }

            rows.push({

                year,

                sourceShares,

                targetShares,

                sourceDividend:
                    sourceDividendCash,

                targetDividend:
                    targetDividendCash,

                boughtTarget:
                    boughtTarget +
                    targetDividendBuy,

                cash,

                totalValue:
                    sourceShares *
                    sourcePriceNow +
                    targetShares *
                    targetPriceNow +
                    cash
            });

            sourcePriceNow *=
                1 + sourceGrowth;

            targetPriceNow *=
                1 + targetGrowth;
        }

        const last =
            rows[rows.length - 1];

        return {

            rows,

            totalContributed,

            finalSourceShares:
                last?.sourceShares || 0,

            finalTargetShares:
                last?.targetShares || 0,

            finalCash:
                last?.cash || 0,

            finalValue:
                last?.totalValue || 0
        };
    }

    const results = {

        weak:
            calculate(scenarios.weak),

        medium:
            calculate(scenarios.medium),

        high:
            calculate(scenarios.high)
    };

    renderProjection(
        source,
        target,
        scenarios,
        results
    );
}

function renderProjection(
    source,
    target,
    scenarios,
    results
) {

    const medium =
        results.medium;

    document.getElementById(
        "projectionSummary"
    ).innerHTML = `

        <div class="projection-stat">
            <span>CP nguồn</span>
            <strong>${source}</strong>
        </div>

        <div class="projection-stat">
            <span>CP đích</span>
            <strong>${target}</strong>
        </div>

        <div class="projection-stat">
            <span>CP đích cuối kỳ</span>
            <strong>
                ${medium.finalTargetShares.toLocaleString("vi-VN")}
            </strong>
        </div>

        <div class="projection-stat">
            <span>Tiền mặt cuối kỳ</span>
            <strong>
                ${money(medium.finalCash)}
            </strong>
        </div>

        <div class="projection-stat">
            <span>Vốn nạp</span>
            <strong>
                ${money(medium.totalContributed)}
            </strong>
        </div>

        <div class="projection-stat">
            <span>Giá trị cuối kỳ</span>
            <strong>
                ${money(medium.finalValue)}
            </strong>
        </div>
    `;

    document.getElementById(
        "projectionScenarioSummary"
    ).innerHTML = `

        <div class="scenario-result">

            <h3>🔴 Yếu</h3>

            <p>
                Cổ tức nguồn:
                <strong>
                    ${money(
                        scenarios.weak.sourceDividend
                    )}
                </strong>
            </p>

            <p>
                Cổ tức đích:
                <strong>
                    ${money(
                        scenarios.weak.targetDividend
                    )}
                </strong>
            </p>

            <p>
                CP ${target} cuối kỳ:
                <strong>
                    ${results.weak.finalTargetShares.toLocaleString("vi-VN")}
                </strong>
            </p>

            <p>
                Tiền mặt:
                <strong>
                    ${money(results.weak.finalCash)}
                </strong>
            </p>

            <p>
                Tổng giá trị:
                <strong>
                    ${money(results.weak.finalValue)}
                </strong>
            </p>

        </div>


        <div class="scenario-result">

            <h3>🟡 Trung bình</h3>

            <p>
                Cổ tức nguồn:
                <strong>
                    ${money(
                        scenarios.medium.sourceDividend
                    )}
                </strong>
            </p>

            <p>
                Cổ tức đích:
                <strong>
                    ${money(
                        scenarios.medium.targetDividend
                    )}
                </strong>
            </p>

            <p>
                CP ${target} cuối kỳ:
                <strong>
                    ${results.medium.finalTargetShares.toLocaleString("vi-VN")}
                </strong>
            </p>

            <p>
                Tiền mặt:
                <strong>
                    ${money(results.medium.finalCash)}
                </strong>
            </p>

            <p>
                Tổng giá trị:
                <strong>
                    ${money(results.medium.finalValue)}
                </strong>
            </p>

        </div>


        <div class="scenario-result">

            <h3>🟢 Cao</h3>

            <p>
                Cổ tức nguồn:
                <strong>
                    ${money(
                        scenarios.high.sourceDividend
                    )}
                </strong>
            </p>

            <p>
                Cổ tức đích:
                <strong>
                    ${money(
                        scenarios.high.targetDividend
                    )}
                </strong>
            </p>

            <p>
                CP ${target} cuối kỳ:
                <strong>
                    ${results.high.finalTargetShares.toLocaleString("vi-VN")}
                </strong>
            </p>

            <p>
                Tiền mặt:
                <strong>
                    ${money(results.high.finalCash)}
                </strong>
            </p>

            <p>
                Tổng giá trị:
                <strong>
                    ${money(results.high.finalValue)}
                </strong>
            </p>

        </div>
    `;

    const rows =
        medium.rows;

    document.getElementById(
        "projectionTable"
    ).innerHTML = `

        <table>

            <thead>

                <tr>
                    <th>Năm</th>
                    <th>CP nguồn</th>
                    <th>Cổ tức nguồn</th>
                    <th>CP đích mua</th>
                    <th>CP đích</th>
                    <th>Cổ tức đích</th>
                    <th>Tiền mặt</th>
                    <th>Tổng giá trị</th>
                </tr>

            </thead>

            <tbody>

                ${rows.map(row => `

                    <tr>

                        <td>
                            ${row.year}
                        </td>

                        <td>
                            ${row.sourceShares.toLocaleString("vi-VN")}
                        </td>

                        <td>
                            ${money(row.sourceDividend)}
                        </td>

                        <td class="projection-buy">
                            ${row.boughtTarget.toLocaleString("vi-VN")}
                        </td>

                        <td>
                            ${row.targetShares.toLocaleString("vi-VN")}
                        </td>

                        <td>
                            ${money(row.targetDividend)}
                        </td>

                        <td class="projection-cash">
                            ${money(row.cash)}
                        </td>

                        <td>
                            ${money(row.totalValue)}
                        </td>

                    </tr>

                `).join("")}

            </tbody>

        </table>
    `;
}

/* ==================================================
   SETTINGS
================================================== */

function loadSettingsForm() {

    const form =
        document.getElementById(
            "settingsForm"
        );

    form.fee.value =
        data.settings.fee;

    form.custody.value =
        data.settings.custody;

    form.interest.value =
        data.settings.interest;

    form.custodyEnabled.checked =
        data.settings.custodyEnabled;
}

function handleSettings(event) {

    event.preventDefault();

    const form =
        event.target;

    data.settings.fee =
        number(form.fee.value);

    data.settings.custody =
        number(form.custody.value);

    data.settings.interest =
        number(form.interest.value);

    data.settings.custodyEnabled =
        form.custodyEnabled.checked;

    saveData();

    showToast(
        "Đã lưu cài đặt"
    );

    renderAll();
}

/* ==================================================
   BACKUP
================================================== */

function backupJSON() {

    const blob =
        new Blob(
            [
                JSON.stringify(
                    data,
                    null,
                    2
                )
            ],
            {
                type:
                    "application/json"
            }
        );

    const url =
        URL.createObjectURL(blob);

    const a =
        document.createElement("a");

    a.href = url;

    a.download =
        "dau-tu-co-tuc-backup.json";

    a.click();

    URL.revokeObjectURL(url);
}

function restoreJSON(event) {

    const file =
        event.target.files[0];

    if (!file) return;

    const reader =
        new FileReader();

    reader.onload = () => {

        try {

            const restored =
                JSON.parse(
                    reader.result
                );

            if (
                !restored ||
                !Array.isArray(
                    restored.deposits
                )
            ) {

                throw new Error(
                    "Backup không hợp lệ"
                );
            }

            data = {

                deposits:
                    restored.deposits || [],

                transactions:
                    restored.transactions || [],

                dividends:
                    restored.dividends || [],

                settings: {
                    ...defaultData.settings,
                    ...(restored.settings || {})
                }
            };

            saveData();

            renderAll();

            loadSettingsForm();

            showToast(
                "Khôi phục dữ liệu thành công"
            );

        } catch (error) {

            console.error(error);

            showToast(
                "File backup không hợp lệ"
            );
        }
    };

    reader.readAsText(file);
}

/* ==================================================
   RESET
================================================== */

function resetAll() {

    if (
        !confirm(
            "CẢNH BÁO!\n\nXóa toàn bộ dữ liệu?"
        )
    ) return;

    data =
        structuredClone(
            defaultData
        );

    saveData();

    renderAll();

    loadSettingsForm();

    showToast(
        "Đã xóa toàn bộ dữ liệu"
    );
}

/* ==================================================
   TABS
================================================== */

function setupTabs() {

    document.querySelectorAll(
        ".tab"
    ).forEach(tab => {

        tab.addEventListener(
            "click",
            () => {

                document.querySelectorAll(
                    ".tab"
                ).forEach(t =>
                    t.classList.remove(
                        "active"
                    )
                );

                document.querySelectorAll(
                    ".tab-panel"
                ).forEach(panel =>
                    panel.classList.remove(
                        "active"
                    )
                );

                tab.classList.add(
                    "active"
                );

                document.getElementById(
                    tab.dataset.tab
                ).classList.add(
                    "active"
                );
            }
        );
    });
}

/* ==================================================
   DIVIDEND TYPE
================================================== */

function setupDividendType() {

    const type =
        document.getElementById(
            "dividendType"
        );

    type.addEventListener(
        "change",
        () => {

            const cash =
                document.getElementById(
                    "cashDividendFields"
                );

            const stock =
                document.getElementById(
                    "stockDividendFields"
                );

            if (type.value === "cash") {

                cash.style.display =
                    "block";

                stock.style.display =
                    "none";

            } else {

                cash.style.display =
                    "none";

                stock.style.display =
                    "block";
            }
        }
    );
}

/* ==================================================
   RENDER ALL
================================================== */

function renderAll() {

    renderDashboard();

    renderTransactions();

    renderDividends();

    renderDeposits();
}

/* ==================================================
   INIT
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupTabs();

        setupDividendType();

        document.getElementById(
            "depositDate"
        ).value = today();

        document.getElementById(
            "tradeForm"
        ).querySelector(
            '[name="date"]'
        ).value = today();

        document.getElementById(
            "dividendForm"
        ).querySelector(
            '[name="recordDate"]'
        ).value = today();

        document.getElementById(
            "dividendForm"
        ).querySelector(
            '[name="payDate"]'
        ).value = today();

        document.getElementById(
            "depositForm"
        ).addEventListener(
            "submit",
            handleDeposit
        );

        document.getElementById(
            "tradeForm"
        ).addEventListener(
            "submit",
            handleTrade
        );

        document.getElementById(
            "dividendForm"
        ).addEventListener(
            "submit",
            handleDividend
        );

        document.getElementById(
            "projectionForm"
        ).addEventListener(
            "submit",
            event => {

                event.preventDefault();

                runProjection();
            }
        );

        document.getElementById(
            "settingsForm"
        ).addEventListener(
            "submit",
            handleSettings
        );

        document.getElementById(
            "restoreInput"
        ).addEventListener(
            "change",
            restoreJSON
        );

        loadSettingsForm();

        renderAll();

        /*
          Chạy dự phóng lần đầu
        */

        runProjection();
    }
);
