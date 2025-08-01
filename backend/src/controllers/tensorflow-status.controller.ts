import { Controller, Get } from '@nestjs/common';
import { getTensorFlowInfo, getTensorFlow } from '../utils/tensorflow-loader';

@Controller('api/tensorflow')
export class TensorFlowStatusController {
    @Get('status')
    async getStatus() {
        const info = getTensorFlowInfo();
        
        // Try to get current memory usage if TensorFlow is loaded
        let memoryInfo = null;
        try {
            const tf = await getTensorFlow();
            memoryInfo = tf.memory();
        } catch (error) {
            // TensorFlow not loaded or failed
        }
        
        return {
            status: info.current !== 'unknown' ? 'active' : 'inactive',
            backend: info.current,
            availableBackends: info.available,
            failedBackends: info.failed,
            performanceMetrics: info.performance,
            memory: memoryInfo,
            timestamp: new Date().toISOString()
        };
    }
    
    @Get('test')
    async testTensorFlow() {
        try {
            const tf = await getTensorFlow();
            
            // Perform a simple test
            const a = tf.tensor([1, 2, 3, 4]);
            const b = tf.tensor([5, 6, 7, 8]);
            const c = a.add(b);
            
            const result = await c.array();
            
            // Clean up
            a.dispose();
            b.dispose();
            c.dispose();
            
            return {
                success: true,
                backend: getTensorFlowInfo().current,
                testResult: result,
                message: 'TensorFlow is working correctly'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                backend: getTensorFlowInfo().current,
                message: 'TensorFlow test failed'
            };
        }
    }
}