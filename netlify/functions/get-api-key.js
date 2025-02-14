exports.handler = async function () {
    return {
        statusCode: 200,
        body: JSON.stringify({ API_KEY: process.env.API_KEY })
    };
};
