#include "exchange.h"

#include <algorithm>
#include <stdexcept>

double GetExchangeRate(std::string currencyCode)
{
    std::string lcCurrency = currencyCode;
    std::transform(lcCurrency.begin(), lcCurrency.end(), lcCurrency.begin(), ::tolower);

    if (lcCurrency == "jpy") return 98214.04;
    if (lcCurrency == "usd") return 866.49;
    throw std::runtime_error("unknown exchange rate");
}
