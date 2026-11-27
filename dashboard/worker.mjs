import {createDashboard} from './environment-server.mjs';
const server=await createDashboard();
server.listen(0,'127.0.0.1',()=>process.send?.({port:server.address().port}));
process.on('disconnect',()=>server.close(()=>process.exit(0)));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
