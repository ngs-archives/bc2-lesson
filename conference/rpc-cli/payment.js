const debug = require('./debug');
const config = require('./config');
const bitcoin = require('./bitcoin');
const db = require('./db');
const model = {
    invoice: require('./models/invoice'),
    payment: require('./models/payment'),
    history: require('./models/history'),
};
const async = require('async');
const assert = require('assert');
const utils = require('./utils');
const { EventSource } = require('./events');

const payment = {
    /**
     * 1. Get a new address designated for this payment.
     * 2. Link the address to the amount, and put into DB.
     * 3. Return the address via the callback.
     */
    createInvoice(satoshi, content, cb) {



        // TASK 1: model.invoiceの作成
        // bitcoinというモジュールを使って、新しいビットコインアドレスを手に入れて、新しい
        // インボイスを作る。
        // ヒント：bitcoinはbcrpc（bitcoin RPC）のwrapperで、bitcoin-cliに使う
        // コマンドをそのまま使えるが、ケースが違う。
        // 例えばgetblockcount（bitcoin-cli）なら、getBlockCount（bcrpc）になる。
        // 非同期なので、bitcoin.関数名(パラメータ１，パラメータ２、…、(エラー変数, 結果変数) => {
        //   エラー変数がnullじゃなければcb(エラー変数)を
        //   じゃなければ、結果は結果変数.resultにある。
        // });
        // 非同期プログラミングが詳しくない方はちょっと勉強した方が良いかもしれない。


        // 注意：下の一行を消さないとならない。createInvoiceが止まらないように入れてある。
        cb('まだ書いてません！');
    },
    paymentStatusWithColor(status) {
        return status[{
            tx_unavail: 'red',
            reorg: 'red',
            confirmed: 'green',
            pending: 'yellow',
        }[status]];
    },
    /**
     * Update an invoice's status. This method checks for double spends,
     * reorgs, etc. and sets the invoice status as appropriate.
     * The callback signature is (error, didUpdate), where didUpdate is true
     * if the invoice was modified, and false if it remained the same.
     */
    updateInvoice(invoiceId, cb) {
        model.invoice.findById(invoiceId, (err, invoices) => {
            if (err) return cb(err);
            if (invoices.length === 0) return cb("invoice " + invoiceId + " not found");
            const invoice = invoices[0];
            model.payment.findByAddr(invoice.addr, (pmtErr, payments) => {
                if (pmtErr) return cb(pmtErr);


                // invoiceのstatusに必要な変数
                let finalAmount = 0;    // 確認した金額のサム
                let totalAmount = 0;    // 全ての金額のサム（未確認＋確認）
                let disabledAmount = 0; // 消えた（あったけどなくなった）金額のサム
                let minConfirms = 999;  // 一番低いconfirmationsの値
                let maxConfirms = 0;    // 一番高いconfirmationsの値


                async.eachSeries(
                    payments,
                    (payment, asyncCallback) => {
                        debug(`checking payment with txid ${payment.txid}`);
                        bitcoin.getTransaction(payment.txid, (gtErr, response) => {
                            if (gtErr) {
                                // transaction is missing or erroneous; we don't consider this an unrecoverable error, we simply don't count this transaction
                                debug('warning: transaction %s for payment %s cannot be retrieved: %s', payment.txid, payment._id, gtErr);
                                model.payment.setStatus(
                                    payment._id,
                                    'tx_unavail',
                                    asyncCallback
                                );
                                return;
                            }
                            const transaction = response.result;
                            // console.log(`   TX = ${JSON.stringify(transaction)}`);

                            // 時々アドレスがdetailsというarrayに入っている。そのときは正しい要素を
                            // 調べる必要がある。
                            this.matchTransactionToAddress(transaction, invoice.addr);

                            const { amount, confirmations, blockhash } = transaction;
                            debug(`-> amount: ${amount} BTC to addr: ${transaction.address} (${confirmations} confirmations) in block ${blockhash}`);
                            const amountSatoshi = utils.satoshiFromBTC(amount);


                            // TASK 2: paymentの対応
                            // ここでは、一つのinvoiceに対するそれぞれのpaymentを一つずつ見ていく。
                            // paymentの情報を確認、集計し、
                            // TASK 3でinvoiceのstatusをアップデートする。
                            // 最後にmodel.payment.setStatusを実行すること。
                            // TODO: 上で定義したinvoiceのstatusに必要な変数を更新する


                            // TODO: TASK 2のコードをここに入れて！


                            // TASK 2の最後に：

                            model.payment.setStatus(
                                payment._id,



                                // paymentは確認されたら（confirmations >= config.requiredConfirmationsだったら)、
                                //  'confirmed',
                                // 未確認なら、
                                'pending',
                                // （修正無しではpendingになる、いつも）


                                asyncCallback
                            );

                            // TASK 2 終わり
                        });
                    },
                    () => {


                        // TASK 3: invoiceのアップデート
                        // TASK 2にこのinvoiceのpaymentをそれぞれ確認して情報を集めた。
                        // ここでは、集めた情報（変数）を使って、invoiceのステータスを
                        // アップデートする。
                        // アップデートが終わったら、cb (callback)を呼ぶ。これは
                        // cbwrapというヘルプ関数がやる。
                        // TODO: そのために以下の変数の値をTASK2で集計した変数を利用して
                        //       入れて下さい。

                        const confirmations = 0; // このinvoiceのconfirmationsは何個ある？複数のpaymentがある場合、どう考えれば良い？
                        const pendingAmount = 0; // 未確認の金額だけ
                        const finalRem = 0; // 確認済みの払われた金額で、払ってない金額はいくら？
                        const totalRem = 0; // 全部の払われた金額で、払ってない金額はいくら？
                        const finalMatch = false; // 確認済みで、払ってもらった金額はぴったり（true）かそうでない（false）か
                        const totalMatch = false; // 未確認＋確認済みの場合

                        const cbwrap = (err, updated) => {
                            // console.log(`${updated ? '!!!' : '...'} c=${confirmations} fr=${finalRem} tr=${totalRem} fm=${finalMatch} tm=${totalMatch}`);
                            if (!err && updated) this.sig('invoice.updated', { invoiceId, status: updated });
                            const keepWatching = confirmations < 100 || !finalMatch || pendingAmount > 0;
                            const finalcb = () => cb(err, { payments, confirmations, updated, finalAmount, pendingAmount, disabledAmount, finalMatch, totalMatch });
                            if (keepWatching !== invoice.watched) {
                                model.invoice.setWatchedState(invoiceId, keepWatching, finalcb);
                            } else finalcb();
                        };

                        // finalRem, totalRem等を使って、model.invoice.updateStatusを実行する。
                        // トータルで７つのステータスが可能である。今のステータスと同じかどうかという事は確認しなくても良い。
                        // 順番は勿論重要だ。

                        // TODO: if (???) return model.invoice.updateStatus(invoiceId, 'paid', cbwrap);
                        // TODO: if ...


                        // 注意：model.invoice.updateStatus(..., ..., cbwrap)が必ず呼ばれることを確認しよう！
                        model.invoice.updateStatus(invoiceId, '???', cbwrap);
                    }
                );
            });
        });
    },
    /**
     * Transactions sometimes send to multiple addresses simultaneously.
     * We tweak the transaction so that its address and amount values are
     * set to the values for the given address.
     *
     * Note: the system will NOT detect multiple sends to the same address
     * within the same transaction. These cases will result in a loss for the
     * sender until the database is updated manually.
     */
    matchTransactionToAddress(transaction, addr) {
        if (transaction.address === addr) return;
        if (transaction.details) {
            for (const d of transaction.details) {
                if (d.address === addr) {
                    assert(d.amount);
                    transaction.address = d.address;
                    transaction.amount = Math.abs(d.amount);
                    return;
                }
            }
        }
        transaction.address = addr;
    },
    /**
     * Locate the invoice for the given transaction, by looking at all its
     * potential addresses. This method also updates the transaction.address
     * and .amount values to the values matching the address.
     */
    findInvoiceForTransaction(transaction, cb) {
        const addresses = [];
        if (transaction.address) addresses.push([ transaction.address, transaction.amount ]);
        if (transaction.details) {
            for (const d of transaction.details) {
                addresses.push([ d.address, Math.abs(d.amount) ]);
            }
        }
        let invoice;
        async.detectSeries(
            addresses,
            ([ addr, amt ], detectCallback) => {
                model.invoice.findByAddr(addr, (err, invoices) => {
                    if (err) return detectCallback(err);
                    if (invoices.length === 0) return detectCallback();
                    if (invoices.length > 1) return detectCallback("multiple invoices with same address detected; database is corrupted\n");
                    invoice = invoices[0];
                    transaction.address = addr;
                    transaction.amount = amt;
                    detectCallback(null, true);
                });
            },
            (addrErr) => cb(addrErr, { transaction, invoice })
        );
    },
    /**
     * Create a new payment object for a given invoice, and attach the transaction
     * to it.
     */
    createPaymentWithTransaction(transactionIn, cb) {
        this.findInvoiceForTransaction(transactionIn, (err, { transaction, invoice }) => {
            if (err) return cb(err);
            if (!invoice) return cb('invoice not found for transaction');
            model.payment.create(transaction.txid, transaction.address, invoice._id, transaction.amount, (crtErr, crtRes) => {
                if (!crtErr)
                    this.sig('payment.created', { transaction, invoice, paymentId: crtRes.insertedIds[0] });
                cb(crtErr, invoice._id);
            });
        });
    },
    /**
     * Update existing payment with a transaction.
     */
    updatePaymentWithTransaction(payment, transactionIn, cb) {
        this.findInvoiceForTransaction(transactionIn, (err, { transaction, invoice }) => {
            if (!invoice) return cb('invoice not found for transaction');
            if (model.payment.upToDate(payment, transaction)) return cb(null, invoice._id);
            model.payment.update(transaction.txid, transaction.address, invoice._id, transaction.amount, (updErr, updRes) => {
                if (!updErr)
                    this.sig('payment.updated', { transaction, invoice, paymentId: payment });
                cb(updErr, invoice._id);
            });
        });
    },
    /**
     * Update existing or create new payment with a transaction.
     */
    updatePayment(transaction, cb) {
        debug(`update payment with transaction ${JSON.stringify(transaction)}`);
        if (!transaction.txid || (!transaction.address && !transaction.details) || transaction.amount < 0) {
            debug(`ignoring irrelevant transaction ${JSON.stringify(transaction)}`);
            return cb('Ignoring irrelevant transaction.');
        }
        model.payment.findByTxId(transaction.txid, (err, payments) => {
            if (err) return cb(err);
            if (payments.length > 0) {
                // payment with matching txid and address
                debug(`updating existing payment with txid ${transaction.txid}`);
                this.updatePaymentWithTransaction(payments[0], transaction, cb);
            } else {
                // no payment exists; make one
                debug(`creating new payment with txid ${transaction.txid}`);
                this.createPaymentWithTransaction(transaction, cb);
            }
        });
    },
};
utils.deasyncObject(payment, ['paymentStatusWithColor']);

payment._e = new EventSource(payment);

module.exports = payment;
