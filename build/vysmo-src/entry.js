/* 打包入口：把 @vysmo/flipbook 的 createFlipbook 挂成全局，供经典 <script src> 使用。 */
import { createFlipbook } from '@vysmo/flipbook';
window.VysmoFlipbook = { createFlipbook: createFlipbook };
