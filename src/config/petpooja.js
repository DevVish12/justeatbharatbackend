const petpoojaConfig = {
    // baseUrl:
    //     process.env.PETPOOJA_BASE_URL ||
    //     "https://qle1yy2ydc.execute-api.ap-southeast-1.amazonaws.com/V1",

 // Menu fetch API
    menuBaseUrl:
        process.env.PETPOOJA_MENU_BASE_URL ||
        "https://qle1yy2ydc.execute-api.ap-southeast-1.amazonaws.com/V1",

    // Order API
    orderBaseUrl:
        process.env.PETPOOJA_ORDER_BASE_URL ||
        "https://47pfzh5sf2.execute-api.ap-southeast-1.amazonaws.com/V1",

    appKey: process.env.PETPOOJA_APP_KEY || "",
    appSecret: process.env.PETPOOJA_APP_SECRET || "",
    accessToken: process.env.PETPOOJA_ACCESS_TOKEN || "",
    restId: process.env.PETPOOJA_REST_ID || "",
    callbackUrl:
        process.env.PETPOOJA_CALLBACK_URL ||
        "https://f823-106-77-133-21.ngrok-free.app/api/petpooja/order-callback",
};

export default petpoojaConfig;
