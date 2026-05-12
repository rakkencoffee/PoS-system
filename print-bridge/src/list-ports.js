const { SerialPort } = require('serialport');

async function listPorts() {
  console.log('Listing all available serial ports...');
  try {
    const ports = await SerialPort.list();
    if (ports.length === 0) {
      console.log('No serial ports found! Please check:');
      console.log('1. Is the printer turned ON?');
      console.log('2. Is it connected via USB or Bluetooth?');
      console.log('3. If Bluetooth, is it paired in Windows Settings?');
      return;
    }

    console.table(ports.map(p => ({
      Path: p.path,
      Manufacturer: p.manufacturer || 'Unknown',
      FriendlyName: p.friendlyName || 'N/A',
      VendorID: p.vendorId || 'N/A',
      ProductID: p.productId || 'N/A'
    })));
    
    const possiblePrinter = ports.find(p => 
      p.friendlyName?.toLowerCase().includes('printer') || 
      p.manufacturer?.toLowerCase().includes('prolific') ||
      p.manufacturer?.toLowerCase().includes('ch340') ||
      p.path.includes('COM')
    );
    
    if (possiblePrinter) {
      console.log(`\n💡 Potential Printer Found: ${possiblePrinter.path} (${possiblePrinter.friendlyName})`);
    }
  } catch (err) {
    console.error('Error listing ports:', err);
  }
}

listPorts();
