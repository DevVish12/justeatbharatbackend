const petpoojaConfig = {
    /* =========================
       MENU (PUSH MODE SAFE)
    ========================= */
    // LIVE में menu fetch use नहीं होता
    // लेकिन null रखो ताकि crash न हो
    menuBaseUrl: process.env.PETPOOJA_MENU_BASE_URL || null,

    /* =========================
       ORDER API (MANDATORY)
    ========================= */
    orderBaseUrl: process.env.PETPOOJA_ORDER_BASE_URL || "",

    /* =========================
       AUTH
    ========================= */
    appKey: process.env.PETPOOJA_APP_KEY || "",
    appSecret: process.env.PETPOOJA_APP_SECRET || "",
    accessToken: process.env.PETPOOJA_ACCESS_TOKEN || "",

    /* =========================
       IDENTIFIERS
    ========================= */
    restId: process.env.PETPOOJA_MAPPING_CODE || "",
    mappingCode: process.env.PETPOOJA_MAPPING_CODE || "",

    /* =========================
       CALLBACK
    ========================= */
    callbackUrl:
        process.env.PETPOOJA_CALLBACK_URL ||
        "https://justeatbharat.com/api/petpooja/order-callback",
};

export default petpoojaConfig;