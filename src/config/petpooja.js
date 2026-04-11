// const petpoojaConfig = {
//     // baseUrl:
//     //     process.env.PETPOOJA_BASE_URL ||
//     //     "https://pponlineordercb.petpooja.com",

//  // Menu fetch API
//     menuBaseUrl:
//         process.env.PETPOOJA_MENU_BASE_URL ||
//         "https://qle1yy2ydc.execute-api.ap-southeast-1.amazonaws.com/V1",

//     // Order API
//     orderBaseUrl:
//         process.env.PETPOOJA_ORDER_BASE_URL ||
//         "https://47pfzh5sf2.execute-api.ap-southeast-1.amazonaws.com/V1",

//     appKey: process.env.PETPOOJA_APP_KEY || "",
//     appSecret: process.env.PETPOOJA_APP_SECRET || "",
//     accessToken: process.env.PETPOOJA_ACCESS_TOKEN || "",
//     restId: process.env.PETPOOJA_REST_ID || "",
//     callbackUrl:
//         process.env.PETPOOJA_CALLBACK_URL ||
//         "https://f823-106-77-133-21.ngrok-free.app/api/petpooja/order-callback",
// };

// export default petpoojaConfig;


const petpoojaConfig = {

    // ❌ REMOVE old sandbox menu fetch (not needed in production)
    // menuBaseUrl:
    //     process.env.PETPOOJA_MENU_BASE_URL ||
    //     "https://qle1yy2ydc.execute-api.ap-southeast-1.amazonaws.com/V1",

    // ✅ ONLY production order base URL (used for save_order / cancel etc.)
    orderBaseUrl:
        process.env.PETPOOJA_ORDER_BASE_URL ||
        "https://pponlineordercb.petpooja.com",

    appKey: process.env.PETPOOJA_APP_KEY || "",
    appSecret: process.env.PETPOOJA_APP_SECRET || "",
    accessToken: process.env.PETPOOJA_ACCESS_TOKEN || "",

    // ✅ NEW production IDs
    restId: process.env.PETPOOJA_REST_ID || "429641",

    // optional but keep if used in payload
    mappingCode: process.env.PETPOOJA_MAPPING_CODE || "qh9wodgpn6",

    // ✅ MUST use your domain (no ngrok in production)
    callbackUrl:
        process.env.PETPOOJA_CALLBACK_URL ||
        "https://justeatbharat.com/api/petpooja/order-callback",
};

export default petpoojaConfig;